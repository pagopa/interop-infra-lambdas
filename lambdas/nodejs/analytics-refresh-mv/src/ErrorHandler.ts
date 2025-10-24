import { logAndRethrow } from "./utils";

class AbortError extends Error {

  constructor( msg: string) {
    super( msg )
  }

}

/**
 * The `ErrorHandler` class is designed to centralize error handling. 
 * It enables differentiation between "aborting" errors (which should immediately halt
 * execution) and "suppressed" errors (which are logged and deferred until finalization).
 * 
 * A usage example is:
 
 ```typescript
  const abortConditionChecker = async (err) => {
      // Custom logic to decide if the process must be aborted
      const isRedshiftClusterDown = await ...... ;
      // If the RedshiftCluster is down we know the error root cause and is not possible 
      // to continue with materialized view refresh.
      return isRedshiftClusterDown ? 'Abort due redshift unavailability' : null; // 
    };
  
  // - The error handler is 'informed' on how to decide if it have to abort the function
  const errorHandler = new ErrorHandler( abortConditionChecker );
  
  // - The process must be executed _inside_ the `executeInterceptingAborts` method.
  //   A method that catch aborting events (`AbortError`) and return the abortMEssage as 
  //   call result; if no abort happen the `executeInterceptingAborts` method return the
  //   inner function return value. In the following example it return 'Hello World'.
  await errorHandler.executeInterceptingAborts(async () => {
    
    try {
      // - Do something essential, the whole process can be aborted.
    }
    catch( error ) {
      // - The essential action throw error, it is impossible to continue.
      throw await errorHandler.checkAborting( error, "Description of the essential action" );
    }
    
    try {
      // - Do something not essential, the whole process can be aborted.
    }
    catch( error ) {
      // - The not essential action throw error, we can continue
      await errorHandler.lenientErrorHandler( error, "Description of the not essential action" );
    }
    
    // - Check if there was errors intercepted by lenientErrorHandler. If at least one was intercepted
    //   log all of them and re-throw an error.
    errorHandler.finalizeErrorHandling();
    return 'Hello World';
  });

```
 */
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

