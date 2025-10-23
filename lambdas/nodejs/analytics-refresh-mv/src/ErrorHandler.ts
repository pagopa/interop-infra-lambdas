import { logAndRethrow } from "./utils";

class AbortError extends Error {

  constructor( msg: string) {
    super( msg )
  }

}

export class ErrorHandler {
  
  #abortChecker: (err: unknown)=> Promise<string|null>;
  #suppressedErrors: {message: string, error:unknown}[]

  constructor( abortChecker: (err: unknown)=> Promise<string|null> ) {
    this.#abortChecker = abortChecker;
    this.#suppressedErrors = []
  }

  async lenientErrorHandler( error: unknown, message: string ) {
    await this.#errorHandler( error, message, () => {
      this.#collectError( error, message );
    })
  }

  async checkAborting( error: unknown, message: string ) {
    return await this.#errorHandler( error, message, () => {
      return logAndRethrow( message, error );
    })
  }

  async #errorHandler( error: unknown, message: string, onError: () => unknown ) {
    console.error( message );
    console.error( error )

    const abortMessage = await this.haveToAbort( error );
    if( abortMessage ) {
      this.#abort( abortMessage );
    }
    else {
      return onError();
    }
  }

  finalizeErrorHandling() {
    if( this.#suppressedErrors.length > 0 ) {
      for( const suppression of this.#suppressedErrors ) {
        console.error( suppression.message );
        console.error( suppression.error )
      }
      throw new Error("Previously suppressed errors are present!!!! See ERROR logs");
    }
  }
  
  protected haveToAbort(error: unknown) {
    return this.#abortChecker( error );
  }

  #abort(abortMessage: string) {
    throw new AbortError( abortMessage );
  }
  
  #collectError(error: unknown, message: string) {
    this.#suppressedErrors.push({ message, error})
  }
  
  
  
  async executeInterceptingAborts( lambda: () => unknown ) {
    try {
      return await lambda();
    }
    catch( error: unknown) {
      if( this.#isAbortError( error )) {
        console.info("Aborting execution: " + error.message);
        return error.message
      }
      else {
        throw logAndRethrow( "Rethrow error that is not an 'abort message'", error );
      }
    }
  }


  #isAbortError(error: unknown): error is AbortError {
    return (
      // - Ensure not null
      error !== null &&
      // - Check if the constructor's name is 'AbortError'
      (error as { constructor: { name: string } }).constructor.name === 'AbortError'
    );
  }

};

