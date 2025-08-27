import { MaterializedViewHelper, ViewAndLevel } from './MaterializedViewHelper';
import { RedshiftDataWrapper } from './RedshiftDataWrapper';

const ERROR_MESSAGES = {
  REQUIRED_PARAMETER: (name: string) => `Parameter '${name}' is required.`,
  REDSHIFT_CLIENT_ERROR: () => `Error creating RedshiftData client`,
  REDSHIFT_LIST_VIEWS_ERROR: () => 'Error listing materialized views',
  REFRESHING_VIEWS: () => 'Error refreshing views',
  REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR: () => 'Error refreshing information about materialized views refresh'
}


exports.handler = async function () {
  
  const SCHEMAS_LIST = parseSchemaList( process.env.VIEWS_SCHEMAS_NAMES );
  const PROCEDURES_SCHEMA = process.env.PROCEDURES_SCHEMA;

  if( PROCEDURES_SCHEMA == undefined ) {
    throw logAndRethrow(ERROR_MESSAGES.REQUIRED_PARAMETER('PROCEDURES_SCHEMA'));
  }

  let materializedViewHelper: MaterializedViewHelper;
  let groupedMaterializedViews: ViewAndLevel[][];
  
  try {
    let redshiftDataClient = new RedshiftDataWrapper(
        process.env.REDSHIFT_CLUSTER_IDENTIFIER,
        process.env.REDSHIFT_DATABASE_NAME,
        process.env.REDSHIFT_DB_USER,
      );
    materializedViewHelper = new MaterializedViewHelper(
        redshiftDataClient,
        SCHEMAS_LIST,
        PROCEDURES_SCHEMA
      );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_CLIENT_ERROR(), error );
  }

  // - List materialized views that need refresh ...
  try {
    const materializedViewList = await materializedViewHelper.listMaterializedViews();

    // ... grouped by depth level.
    groupedMaterializedViews = groupMaterializedViews( materializedViewList );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_LIST_VIEWS_ERROR(), error );
  }
  
  // - Refresh views in parallel, starting from dependencies.
  for( const materializedViewsGroup of groupedMaterializedViews ) {
    console.log( materializedViewsGroup );
    
    try {
      const refreshing = materializedViewsGroup.map( 
        v => materializedViewHelper.refreshOneMaterializedView( v.mvSchemaName, v.mvName )
      );
      await Promise.all( refreshing );

    } catch (error) {
        throw logAndRethrow(ERROR_MESSAGES.REFRESHING_VIEWS(), error );
    } 
  }

  // - Update last refresh info table, useful for quicksight user.
  try {
    await materializedViewHelper.updateLastMvRefreshInfo();
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR(), error );
  }

};


function groupMaterializedViews( infos: ViewAndLevel[]): ViewAndLevel[][] {

  const tmp: { [key: string]: ViewAndLevel[] } = {};

  infos.forEach( el => {
    const key = ("000000000" + el.mvLevel).slice(-5);
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

function parseSchemaList( jsonArrayStr: string | undefined): string[] {
  if( jsonArrayStr == undefined ) {
    throw new Error("Schema list can't be empty");
  }

  return JSON.parse( jsonArrayStr );
}

function logAndRethrow(message: string, error?: unknown): Error {
  console.error(message);
  console.error(error);
  return new Error( message + "\n" + error );
}
