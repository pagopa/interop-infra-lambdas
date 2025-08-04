import { RedshiftDataWrapper } from './RedshiftDataWrapper';

const ERROR_MESSAGES = {
  REDSHIFT_CLIENT_ERROR: () => `Error creating RedshiftData client`,
  REDSHIFT_LIST_VIEWS_ERROR: () => 'Error listing materialized views',
  REFRESHING_VIEWS: () => 'Error refreshing views'
}

type ViewAndLevel = {
    mvFullName: string;
    mvLevel: number;
};


exports.handler = async function () {

  let redshiftDataClient: RedshiftDataWrapper;
  let groupedMaterializedViews: string[][];
  
  try {
    redshiftDataClient = new RedshiftDataWrapper(
        process.env.REDSHIFT_CLUSTER_IDENTIFIER,
        process.env.REDSHIFT_DATABASE_NAME,
        process.env.REDSHIFT_DB_USER,
      );
  } catch (error) {
    return createErrorResponse(ERROR_MESSAGES.REDSHIFT_CLIENT_ERROR(), error );
  }

  // - List materialized views that need refresh ...
  try {
    const materializedViewList: ViewAndLevel[] = await listMaterializedViews( redshiftDataClient );

    // ... grouped by depth level.
    groupedMaterializedViews = groupMaterializedViews( materializedViewList );
  } catch (error) {
    return createErrorResponse(ERROR_MESSAGES.REDSHIFT_LIST_VIEWS_ERROR(), error );
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
        return createErrorResponse(ERROR_MESSAGES.REFRESHING_VIEWS(), error );
    }
    
  }

  return createSuccessResponse( "Materialized views updated");
};



async function listMaterializedViews( redshiftDataClient: RedshiftDataWrapper ): Promise<ViewAndLevel[]> {
  
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
              schema_name in ('views', 'sub_views')
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

function createErrorResponse(message: string, error?: unknown) {
  console.error(message);
  console.error(error);
  return {
    statusCode: 500,
    body: JSON.stringify({
      message,
      error
    })
  };
}

function createSuccessResponse( result: string ) {
  return {
    statusCode: 200,
    body: result
  };
}
