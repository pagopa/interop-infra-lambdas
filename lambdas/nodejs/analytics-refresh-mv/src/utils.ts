
export function assertNotEmptyAndTrim( val: string | undefined, name: string) {
  
  if ( !val || !val.trim() ) {
    const message = name + " can't be empty";
    console.error(message);
    throw new Error(message);
  }
  return val.trim();
}

// - Allow also '_' character
export function assertAlphanumericNotEmptyAndTrim( val: string | undefined, name: string ) {
  const definedVal = assertNotEmptyAndTrim( val, name);

  if( ! /^[a-zA-Z0-9_]*$/.test( definedVal )) {
    const message = name + " in not alphanumeric";
    console.error(message);
    throw new Error(message);
  }

  return definedVal;
}

export function intToStringWithZeroPadding( i: number, strLength: number ) {
  if ( i >= Math.pow( 10, strLength)) {
    throw new Error( i + " is not representable with " + strLength + " base 10 digits");
  }
  return ("0".repeat(strLength) + i).slice(-1 * strLength);
}

export function parseSchemaList( jsonArrayStr: string | undefined): string[] {
  
  // Typescript Custom type guard function; need to check the result of JSON parsing
  function isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every(item => typeof item === 'string')
    );
  }

  if( jsonArrayStr == undefined ) {
    throw new Error("Schema list can't be empty, must be a string array in json format.");
  }

  const result = JSON.parse( jsonArrayStr );
  if( !isStringArray(result) ) {
    throw new Error("Schema list must be a string array in json format.");
  }
  
  return result;
}

export function logAndRethrow(message: string, error?: unknown): Error {
  console.error(message);
  console.error(error);
  return new Error( message + "\n" + error );
}

 