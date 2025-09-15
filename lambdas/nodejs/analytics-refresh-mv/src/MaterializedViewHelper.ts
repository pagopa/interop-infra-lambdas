import { IRedshiftDataWrapper } from "./IRedshiftDataWrapper";
import { assertAlphanumericNotEmptyAndTrim } from "./utils";
import { ViewAndLevel } from "./ViewAndLevel";

export class MaterializedViewHelper {
  
  #redshiftWrapper: IRedshiftDataWrapper;
  #viewsSchemas: string[];
  #proceduresSchema: string;
  
  constructor(
    redshiftWrapper: IRedshiftDataWrapper,
    viewsSchemas: string[],
    proceduresSchema: string| undefined,
  ) 
  {
    this.#redshiftWrapper = redshiftWrapper;
    this.#viewsSchemas = viewsSchemas;
    this.#proceduresSchema = assertAlphanumericNotEmptyAndTrim( proceduresSchema, "proceduresSchema" );
  }

  async listStaleMaterializedViews(): Promise<ViewAndLevel[]> {
    
    const schemasList = this.#viewsSchemas.join(", ");
    const LIST_MV_VIEWS = [
      {
        sql: "CALL \"" + this.#proceduresSchema + "\".list_stale_materialized_views( :schemasList );",
        parameters: { schemasList }
      },
      {
        sql: `
          SELECT
            mv_schema, mv_name, mv_level, 
            incremental_refresh_not_supported, 
            last_refresh_start_time, 
            last_refresh_end_time,
            last_refresh_start_time_epoch,
            last_refresh_end_time_epoch
          FROM
            list_need_refresh_views_results
          ORDER BY
            mv_level asc,
            mv_schema asc,
            mv_name asc
          ;`,
        parameters: {}
      }
    ]
  
    const commandsResults = await this.#redshiftWrapper.executeSqlStatementsWithData( LIST_MV_VIEWS );
    const result : ViewAndLevel[] = []
    
    const records = commandsResults[1]?.Records;
    if( records ) {

      records.forEach(rec => {
  
        const mvSchemaName = rec[0].stringValue;
        const mvName = rec[1].stringValue;
        const mvLevel = rec[2].longValue;
        if( !mvSchemaName || !mvName || mvLevel === undefined ) {
          throw new Error( JSON.stringify(rec) + " some field is missing or null ");
        }
        const incrementalRefreshNotSupported = rec[3].booleanValue || false;
        const lastRefreshStartTime = rec[4].stringValue;
        const lastRefreshEndTime = rec[5].stringValue;
        const lastRefreshStartTimeEpoch = rec[6].longValue || 0;
        const lastRefreshEndTimeEpoch = rec[7].longValue || 0;
        const oneView = { 
          mvSchemaName, 
          mvName, 
          mvLevel, 
          incrementalRefreshNotSupported, 
          lastRefreshStartTime, 
          lastRefreshEndTime,
          lastRefreshStartTimeEpoch,
          lastRefreshEndTimeEpoch
        };
        result.push( oneView );
      })
    }
    else {
      throw new Error("Listing query expected to return a result set");
    }
    return result;
  }
  
  async refreshOneMaterializedView( schemaName: string, mvName: string ): Promise<string> {

    const sql = "CALL \"" + this.#proceduresSchema + "\".refresh_materialized_view( :schemaName, :mvName );" 
    const params = { schemaName, mvName }
    
    console.log(" - start " + sql + " Params: " + JSON.stringify( params ));
    await this.#redshiftWrapper.executeSqlStatement( sql, params );
    console.log(" - end " + sql + " Params: " + JSON.stringify( params ));
    return mvName;
  }

  async updateLastMvRefreshInfo(): Promise<string> {

    const schemasList = this.#viewsSchemas.join(", ");
    const sql = "CALL \"" + this.#proceduresSchema 
                                   + "\".update_last_mv_refresh_info( :schemasList );";
    const params = { schemasList };

    console.log(" - start " + sql + " Params: " + JSON.stringify( params ));
    await this.#redshiftWrapper.executeSqlStatement( sql, params );
    console.log(" - end " + sql + " Params: " + JSON.stringify( params ));
    return "table updated";
  }

}
