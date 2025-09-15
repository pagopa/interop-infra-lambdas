import { ViewAndLevel } from "./ViewAndLevel";
import { intToStringWithZeroPadding } from "./utils";

// - Group by level
export function groupMaterializedViews( infos: ViewAndLevel[]): ViewAndLevel[][] {

  // - Every property of tmp will represent a level.
  const tmp: { [key: string]: ViewAndLevel[] } = {};

  infos.forEach( el => {

    // - 5 means max 100k views dependency levels, it will be enough  
    const key = intToStringWithZeroPadding( el.mvLevel, 5 ); 
    if( ! tmp[key] ) {
      tmp[key] = [];
    }

    tmp[key].push(el)
  })

  const grouped: ViewAndLevel[][] = [];
  const sortedLevelKeys = Object.keys( tmp ).sort();
  console.log(" - Stale levels array is ", sortedLevelKeys );

  for( const key of sortedLevelKeys ) {
    grouped.push( tmp[key] )
  }
  return grouped;
}

