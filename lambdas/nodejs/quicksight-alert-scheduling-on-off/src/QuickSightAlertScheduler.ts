import { AwsQuickSightWrapper, DataSetSummaryWithTags } from "./AwsQuickSightWrapper";

const REFRESH_TYPE_TAG_NAME = "RefreshType"

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

  async activateScheduling( ) {
    await this.#doForEachScheduleSupportingDataSet(
      async (dataSetWithTags) => {
        const refreshType = this.#qs.getTagValue( dataSetWithTags, REFRESH_TYPE_TAG_NAME )
        if( refreshType ) { 
          await this.#qs.createRefreshSchedule( dataSetWithTags, refreshType )
        }
        else {
          throw new Error(`Can't schedule DataSet ${dataSetWithTags.Arn} do not has tag ${REFRESH_TYPE_TAG_NAME}`)
        }
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