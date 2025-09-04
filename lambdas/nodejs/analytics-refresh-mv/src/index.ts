import { groupMaterializedViews } from './groupMaterializedViews';
import { MaterializedViewHelper, ViewAndLevel } from './MaterializedViewHelper';
import { RedshiftClusterChecker } from './RedshiftClusterChecker';
import { RedshiftDataWrapper } from './RedshiftDataWrapper';
import { logAndRethrow, parseSchemaList } from './utils';

const ERROR_MESSAGES = {
  REQUIRED_PARAMETER: (name: string) => `Parameter '${name}' is required.`,
  REDSHIFT_CLIENT_ERROR: () => `Error creating Redshift API client`,
  REDSHIFT_DATA_CLIENT_ERROR: () => `Error creating RedshiftData client`,
  MV_HELPER_ERROR: () => `Error creating MaterializedViewHelper client`,
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
  let redshiftClusterChecker;
  let redshiftDataClient;
  
  const redshiftClusterIdentifier = process.env.REDSHIFT_CLUSTER_IDENTIFIER
  // - Create redshift cluster availability checker
  try {
    redshiftClusterChecker = new RedshiftClusterChecker(
        redshiftClusterIdentifier
      );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_CLIENT_ERROR(), error );
  }
  
  // - Create redshift data client
  try {
    redshiftDataClient = new RedshiftDataWrapper(
        redshiftClusterIdentifier,
        process.env.REDSHIFT_DATABASE_NAME,
        process.env.REDSHIFT_DB_USER,
      );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_DATA_CLIENT_ERROR(), error );
  }
  
  // - Create class that help with materialized view refresh
  try {
    materializedViewHelper = new MaterializedViewHelper(
        redshiftDataClient,
        SCHEMAS_LIST,
        PROCEDURES_SCHEMA
      );
  } catch (error) {
    throw logAndRethrow(ERROR_MESSAGES.MV_HELPER_ERROR(), error );
  }

  // - List materialized views that need refresh ...
  try {
    const materializedViewList = await materializedViewHelper.listStaleMaterializedViews();
    
    // ... grouped by depth level.
    groupedMaterializedViews = groupMaterializedViews( materializedViewList );
  } catch (error) {
    if( await redshiftClusterChecker.isAvailable() ) {
      throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_LIST_VIEWS_ERROR(), error );
    }
    else {
      console.warn("Exiting because Redshift Cluster is down");
      return;
    }
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
      if( await redshiftClusterChecker.isAvailable() ) {
        throw logAndRethrow(ERROR_MESSAGES.REFRESHING_VIEWS(), error );
      }
      else {
        console.warn("Exiting because Redshift Cluster is down");
        return;
      }
    } 
  }

  // - Update last refresh info table, useful for quicksight user.
  try {
    const updated = await materializedViewHelper.updateLastMvRefreshInfo();
  } catch (error) {
    if( await redshiftClusterChecker.isAvailable() ) {
      throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR(), error );
    }
    else {
      console.warn("Exiting because Redshift Cluster is down");
      return;
    }
  }

};


