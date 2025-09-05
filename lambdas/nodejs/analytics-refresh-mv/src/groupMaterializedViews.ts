import { ViewAndLevel } from "./MaterializedViewHelper";
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
  for( const key of Object.keys( tmp).sort() ) {
    grouped.push( tmp[key] )
  }
  return grouped;
}

