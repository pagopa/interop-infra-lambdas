import { RedshiftDataWrapper } from './RedshiftDataWrapper';

const ERROR_MESSAGES = {
  REQUIRED_PARAMETER: (name: string) => `Parameter '${name}' is required.`,
  REDSHIFT_CLIENT_ERROR: () => `Error creating RedshiftData client`,
  REDSHIFT_LIST_VIEWS_ERROR: () => 'Error listing materialized views',
  REFRESHING_VIEWS: () => 'Error refreshing views',
  REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR: () => 'Error refreshing information about materialized views refresh'
}

type ViewAndLevel = {
    mvFullName: string;
    mvLevel: number;
};


exports.handler = async function () {
  
  const SCHEMAS_LIST = parseSchemaList( process.env.VIEWS_SCHEMAS_NAMES );
  const PROCEDURES_SCHEMA = process.env.PROCEDURES_SCHEMA;

  if( PROCEDURES_SCHEMA == undefined ) {
    throw logAndRethrow(ERROR_MESSAGES.REQUIRED_PARAMETER('PROCEDURES_SCHEMA'));
  }

  let redshiftDataClient: RedshiftDataWrapper;
  let groupedMaterializedViews: string[][];
  
  try {
    redshiftDataClient = new RedshiftDataWrapper(
        process.env.REDSHIFT_CLUSTER_IDENTIFIER,
        process.env.REDSHIFT_DATABASE_NAME,
        process.env.REDSHIFT_DB_USER,
      );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_CLIENT_ERROR(), error );
  }

  // - List materialized views that need refresh ...
  try {
    const materializedViewList: ViewAndLevel[] = await listMaterializedViews( redshiftDataClient, SCHEMAS_LIST );

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
        name => refreshOneMaterializedView( redshiftDataClient, name) 
      );
      await Promise.all( refreshing );

    } catch (error) {
        throw logAndRethrow(ERROR_MESSAGES.REFRESHING_VIEWS(), error );
    } 
  }

  // - Update last refresh info table, useful for quicksight user.
  try {
    await updateLastMvRefreshInfo( redshiftDataClient, PROCEDURES_SCHEMA, SCHEMAS_LIST );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR(), error );
  }

};



async function listMaterializedViews( redshiftDataClient: RedshiftDataWrapper, schemas: string[] ): Promise<ViewAndLevel[]> {

  const LIST_MV_VIEWS = `
      with
        views_to_refresh as (
          select
            schema_name + '.' + name as mv_full_name,
            cast(REGEXP_REPLACE( name, 'mv_([0-9][0-9]).*', '$1') as integer) as mv_level 
          from 
            SVV_MV_INFO
          where
              is_stale = 't'
            and 
              schema_name in ( '${schemas.join("', '")}' )
        )
      select
        mv_full_name,
        mv_level
      from
        views_to_refresh
      order by
        mv_level asc,
        mv_full_name asc
    `;

  const commandResult = await redshiftDataClient.executeSqlStatementWithData( LIST_MV_VIEWS );
  const result : ViewAndLevel[] = []
  
  if( commandResult.Records ) {
    commandResult.Records.forEach(rec => {

      const mvFullName = rec[0].stringValue;
      const mvLevel = rec[1].longValue;
      if( !mvFullName || mvLevel === undefined ) {
        throw new Error( JSON.stringify(rec) + " has no viewName or level");
      }
      const oneView = { mvFullName, mvLevel };
      result.push( oneView );
    })
  }
  return result;
}



function groupMaterializedViews( infos: ViewAndLevel[]): string[][] {

  const tmp: { [key: string]: string[] } = {};

  infos.forEach( el => {
    const key = ("000000000" + el.mvLevel).slice(-5);
    if( ! tmp[key] ) {
      tmp[key] = [];
    }

    tmp[key].push(el.mvFullName)
  })

  const grouped: string[][] = [];
  for( const key of Object.keys( tmp).sort() ) {
    grouped.push( tmp[key] )
  }
  return grouped;
}

async function refreshOneMaterializedView( redshiftDataClient: RedshiftDataWrapper, name: string ): Promise<string> {
  const sql = "REFRESH MATERIALIZED VIEW " + name;
  console.log("Start " + sql );
  await redshiftDataClient.executeSqlStatement( sql );
  console.log("End " + sql );
  return name;
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

async function updateLastMvRefreshInfo(
  redshiftDataClient: RedshiftDataWrapper,
  procedureSchema: string,
  schemas: string[]
): Promise<string>
{
  const sql = "CALL " + procedureSchema + ".update_last_mv_refresh_info( '" + schemas.join(", ") + "' )";
  console.log("Start " + sql );
  await redshiftDataClient.executeSqlStatement( sql );
  console.log("End " + sql );
  return "table updated";
}
