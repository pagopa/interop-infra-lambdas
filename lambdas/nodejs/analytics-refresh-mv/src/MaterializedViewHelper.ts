import { RedshiftDataWrapper } from "./RedshiftDataWrapper";
import { assertAlphanumericNotEmpty } from "./utils";

export type ViewAndLevel = {
    mvSchemaName: string;
    mvName: string;
    mvLevel: number;
};


export class MaterializedViewHelper {
  
  #redshiftWrapper: RedshiftDataWrapper;
  #viewsSchemas: string[];
  #proceduresSchema: string;
  
  constructor(
    redshiftWrapper: RedshiftDataWrapper,
    viewsSchemas: string[],
    proceduresSchema: string| undefined,
  ) 
  {
    this.#redshiftWrapper = redshiftWrapper;
    this.#viewsSchemas = viewsSchemas;
    this.#proceduresSchema = assertAlphanumericNotEmpty( proceduresSchema, "proceduresSchema" );
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
            mv_schema, mv_name, mv_level
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
    
    if( commandsResults && commandsResults.length > 0 && commandsResults[1] && commandsResults[1].Records ) {

      commandsResults[1].Records.forEach(rec => {
  
        const mvSchemaName = rec[0].stringValue;
        const mvName = rec[1].stringValue;
        const mvLevel = rec[2].longValue;
        if( !mvSchemaName || !mvName || mvLevel === undefined ) {
          throw new Error( JSON.stringify(rec) + " some field is missing or null ");
        }
        const oneView = { mvSchemaName, mvName, mvLevel };
        result.push( oneView );
      })
    }
    return result;
  }
  
  async refreshOneMaterializedView( schemaName: string, mvName: string ): Promise<string> {

    const sql = "CALL \"" + this.#proceduresSchema + "\".refresh_materialized_view( :schemaName, :mvName );" 
    const params = { schemaName, mvName }
    
    console.log("Start " + sql + " Params: " + JSON.stringify( params ));
    await this.#redshiftWrapper.executeSqlStatement( sql, params );
    console.log("End " + sql + " Params: " + JSON.stringify( params ));
    return mvName;
  }

  async updateLastMvRefreshInfo(): Promise<string> {

    const schemasList = this.#viewsSchemas.join(", ");
    const sql = "CALL \"" + this.#proceduresSchema 
                                   + "\".update_last_mv_refresh_info( :schemasList );";
    const params = { schemasList };

    console.log("Start " + sql + " Params: " + JSON.stringify( params ));
    await this.#redshiftWrapper.executeSqlStatement( sql, params );
    console.log("End " + sql + " Params: " + JSON.stringify( params ));
    return "table updated";
  }

}
