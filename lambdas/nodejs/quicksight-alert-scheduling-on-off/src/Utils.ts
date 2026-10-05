
export type KeyValue = { Key: string | undefined, Value: string | undefined}

export function fromKeyValueArrayToObject( arr: KeyValue[]) {
  const result: { [key: string]: string | undefined } = {};
  for( const element of arr ) {
    if( element.Key ) {
      result[ element.Key ] = element.Value
    }
  }
  return result;
}

export function computeScheduleSuffix( index: number ): string {
  let result: string;
  if( index == 0 ) {
    result = "";
  }
  else if ( index == 1 || index == 2 || index == 3 || index == 4 ) {
    result = `_${index+1}`
  }
  else {
    throw new Error(`Schedule index "${index}" not supported! Expected one of 0 1 2 3 4`)
  }
  return result;
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
