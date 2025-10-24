
import { ErrorHandler } from './ErrorHandler';
import { groupMaterializedViews } from './groupMaterializedViews';
import { MaterializedViewHelper } from './MaterializedViewHelper';
import { RedshiftClusterChecker } from './RedshiftClusterChecker';
import { RedshiftDataWrapper } from './RedshiftDataWrapper';
import { StaleMaterializedViewFilter } from './StaleMaterializedViewFilter';
import { logAndRethrow, parseSchemaList } from './utils';
import { ViewAndLevel } from './ViewAndLevel';

const ERROR_MESSAGES = {
  REQUIRED_PARAMETER: (name: string) => `Parameter '${name}' is required.`,
  REDSHIFT_CLIENT_ERROR: () => `Error creating Redshift API client`,
  REDSHIFT_DATA_CLIENT_ERROR: () => `Error creating RedshiftData client`,
  MV_HELPER_ERROR: () => `Error creating MaterializedViewHelper client`,
  REDSHIFT_LIST_VIEWS_ERROR: () => 'Error listing materialized views',
  REFRESHING_VIEWS: () => 'Error refreshing views',
  REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR: () => 'Error refreshing information about materialized views refresh'
}


export class MaterializedViewRefresherLambda {

  #materializedViewHelper: MaterializedViewHelper;
  #redshiftClusterChecker: RedshiftClusterChecker;
  #errorHandler: ErrorHandler;
  #redshiftDataClient: RedshiftDataWrapper;  
  #staleMvFilter: StaleMaterializedViewFilter;

  constructor( env: NodeJS.ProcessEnv ) {

    const SCHEMAS_LIST = parseSchemaList( env.VIEWS_SCHEMAS_NAMES );
    const PROCEDURES_SCHEMA = env.PROCEDURES_SCHEMA;

    if( PROCEDURES_SCHEMA == undefined ) {
      throw logAndRethrow(ERROR_MESSAGES.REQUIRED_PARAMETER('PROCEDURES_SCHEMA'));
    }

    this.#staleMvFilter = new StaleMaterializedViewFilter( env );
    
    const redshiftClusterIdentifier = process.env.REDSHIFT_CLUSTER_IDENTIFIER

    // - Create redshift cluster availability checker
    try {
      this.#redshiftClusterChecker = new RedshiftClusterChecker(
          redshiftClusterIdentifier
        );
      const abortChecker = async () => {
          const clusterAvailable = await this.#redshiftClusterChecker.isAvailable();
          return ! clusterAvailable ? `Aborting because Redshift Cluster ${redshiftClusterIdentifier} is down`: null
        };
      this.#errorHandler = new ErrorHandler( abortChecker );
    } catch (error) {
      throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_CLIENT_ERROR(), error );
    }
    
    // - Create redshift data client
    try {
      this.#redshiftDataClient = new RedshiftDataWrapper(
          redshiftClusterIdentifier,
          process.env.REDSHIFT_DATABASE_NAME,
          process.env.REDSHIFT_DB_USER,
        );
    } catch (error) {
      throw logAndRethrow(ERROR_MESSAGES.REDSHIFT_DATA_CLIENT_ERROR(), error );
    }
    
    // - Create class that help with materialized view refresh
    try {
      this.#materializedViewHelper = new MaterializedViewHelper(
          this.#redshiftDataClient,
          SCHEMAS_LIST,
          PROCEDURES_SCHEMA
        );
    } catch (error) {
      throw logAndRethrow(ERROR_MESSAGES.MV_HELPER_ERROR(), error );
    }
  }

  async executeMaterializedViewRefresh() {
    return await this.#errorHandler.executeInterceptingAborts( 
      async() => await this.#executeMaterializedViewRefresh_throwAbort()
    )
  }

  async #executeMaterializedViewRefresh_throwAbort() {

    let groupedMaterializedViews: ViewAndLevel[][];

    // - List materialized views that need refresh ...
    try {
      console.log("Start stale materialized views listing");
      const materializedViewList = await this.#materializedViewHelper.listStaleMaterializedViews();
      console.log(" - stale view listing returned "+ materializedViewList.length + " views.");

      console.log("\nStart stale materialized view filtering");
      const filteredMaterializedViewList = await this.#staleMvFilter.filterAll( materializedViewList );
      
      console.log("\nDecide to refresh "+ filteredMaterializedViewList.length + " views.");

      // ... grouped by depth level.
      groupedMaterializedViews = groupMaterializedViews( filteredMaterializedViewList );
    } catch (error) {
      throw await this.#errorHandler.checkAborting( error, ERROR_MESSAGES.REDSHIFT_LIST_VIEWS_ERROR() );
    }
    
    // - Refresh views in parallel, starting from dependencies.
    console.log("The stale views to be refreshed are at " + groupedMaterializedViews.length + " different levels.")
    for( const materializedViewsGroup of groupedMaterializedViews ) {
      console.log("\nStart same level views refresh ", materializedViewsGroup );
      
      try {
        const refreshing = materializedViewsGroup.map( 
          v => this.#materializedViewHelper.refreshOneMaterializedView( v.mvSchemaName, v.mvName )
        );
        await Promise.all( refreshing );

      } catch (error) {
        await this.#errorHandler.lenientErrorHandler( error, ERROR_MESSAGES.REFRESHING_VIEWS() );
      }
      console.log("End same level views refresh");
    }

    // - Update last refresh info table, useful for quicksight user.
    if( groupedMaterializedViews.length > 0 ) {
      try {
        console.log("\nStart updating table with materialized view refresh timestamp");
        await this.#materializedViewHelper.updateLastMvRefreshInfo();
        console.log("End updating table with materialized view refresh timestamp");
      } catch (error) {
        await this.#errorHandler.lenientErrorHandler( error, ERROR_MESSAGES.REDSHIFT_UPDATE_LAST_REFRESH_INFO_ERROR() );
      }
      
      this.#errorHandler.finalizeErrorHandling();
      return "Refresh Completed"
    }
    else {
      console.log("\nNo Refresh done. Skip update of materialized view refresh timestamp!!")
      return "Refresh Completed, no refresh done!"
    }
  }

}
