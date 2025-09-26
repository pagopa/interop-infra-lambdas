import { AwsQuickSightWrapper, DataSetSummaryWithTags } from "./AwsQuickSightWrapper";

const REFRESH_TYPE_TAG_NAME = "RefreshType"
const REFRESH_INTERVAL_TAG_NAME = "RefreshInterval"

export class QuickSightAlertScheduler {

  #qs: AwsQuickSightWrapper;

  constructor( qs: AwsQuickSightWrapper ) {
    this.#qs = qs;
  }

  async #doForEachScheduleSupportingDataSet( 
    actionLambda: (ds: DataSetSummaryWithTags) => Promise<void>
  ) {
    const dataSetsWithTags = await this.#qs.listScheduleSupportingDataSets();

    console.log( "DataSet that support alert check scheduling" );
    console.log( JSON.stringify( dataSetsWithTags, null, 2 ) );

    const dataSetsToBeModified = dataSetsWithTags.filter(
      (dataSetsWithTags) => this.#qs.getTagValue( dataSetsWithTags, REFRESH_TYPE_TAG_NAME )
    )

    console.log( "DataSet with RefreshType tag" );
    console.log( JSON.stringify( dataSetsToBeModified, null, 2 ) );

    const actionsPromises = dataSetsToBeModified.map( (ds) => actionLambda(ds) )
    return await Promise.all( actionsPromises )
  }

  #defineScheduling( dataSetWithTags: DataSetSummaryWithTags ) {
    const refreshType = this.#qs.getTagValue( dataSetWithTags, REFRESH_TYPE_TAG_NAME );
    if( ! refreshType ) {
      const msg = "Can't schedule DataSet " + dataSetWithTags.Arn + " do not has tag RefreshType";
      console.error( msg );
      throw new Error( msg );
    }
    
    let refreshInterval = this.#qs.getTagValue( dataSetWithTags, REFRESH_INTERVAL_TAG_NAME );
    if( !refreshInterval ) {
      refreshInterval = (refreshType == "INCREMENTAL_REFRESH" ? "MINUTE15" : "HOURLY");
    }
    
    return { refreshType, refreshInterval }
  }

  async activateScheduling( ) {
    await this.#doForEachScheduleSupportingDataSet(
      async (dataSetWithTags) => {
        const refreshParams = this.#defineScheduling( dataSetWithTags );
        await this.#qs.createRefreshSchedule( dataSetWithTags, refreshParams )
      }
    )
  }

  async deactivateScheduling( ) {
    await this.#doForEachScheduleSupportingDataSet(
      async (dataSetWithTags) => {
        await this.#qs.deleteRefreshSchedule( dataSetWithTags )
      }
    )
  }
   
}