
export function assertNotEmpty( val: string | undefined, name: string) {
  
  if ( !val || ( typeof val == "string" && !val.trim()) ) {
    const message = name + " can't be empty";
    console.error(message);
    throw new Error(message);
  }
  return val;
}

// - Allow also '_' character
export function assertAlphanumericNotEmpty( val: string | undefined, name: string ) {
  const definedVal = assertNotEmpty( val, name);

  if( ! /^[a-zA-Z0-9_]*$/.test( definedVal )) {
    const message = name + " in not alphanumeric";
    console.error(message);
    throw new Error(message);
  }

  return definedVal;
}

export function intToStringWithZeroPadding( i: number, strLength: number ) {
  return ("000000000" + i).slice(-1 * strLength);
}
 