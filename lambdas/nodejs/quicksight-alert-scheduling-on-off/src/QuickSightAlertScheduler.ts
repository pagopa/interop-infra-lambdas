import { 
  AwsQuickSightWrapper, 
  DataSetSummaryWithTags,
  RefreshParameters,
  refreshParameterFactory
} from "./AwsQuickSightWrapper";
import { computeScheduleSuffix } from './Utils'

const REFRESH_TYPE_TAG_PREFIX =
  process.env.REFRESH_TYPE_TAG_PREFIX ?? "RefreshType";

const REFRESH_INTERVAL_TAG_PREFIX =
  process.env.REFRESH_INTERVAL_TAG_PREFIX ?? "RefreshInterval";

const MAX_REFRESH_SCHEDULER_QUANTITY = 5;

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
      (dataSetsWithTags) => this.#qs.hasTagsByPrefix( dataSetsWithTags, REFRESH_TYPE_TAG_PREFIX )
    )

    console.log( "DataSet with RefreshType tag" );
    console.log( JSON.stringify( dataSetsToBeModified, null, 2 ) );

    const actionsPromises = dataSetsToBeModified.map( (ds) => actionLambda(ds) )
    return await Promise.all( actionsPromises )
  }

  #defineScheduling( dataSetWithTags: DataSetSummaryWithTags ): RefreshParameters[] {
    const result: RefreshParameters[] = [];

    for( let index = 0; index < MAX_REFRESH_SCHEDULER_QUANTITY; index += 1 ) {
      const suffix = computeScheduleSuffix( index );

      const { refreshType, refreshInterval} = this.#refreshInfoFromTags( dataSetWithTags, suffix );
      
      if( refreshType ) {
        result.push( refreshParameterFactory( index, refreshType, refreshInterval ));
      }
      else {
        if ( index == 0 ) { // - The first must be present
          const msg = "Can't schedule DataSet " + dataSetWithTags.Arn + " do not has tag RefreshType";
          console.error( msg );
          throw new Error( msg );
        }
      }
    }
    return result;
  }

  #refreshInfoFromTags( dataSetWithTags: DataSetSummaryWithTags, suffix: string ) {
    const type = this.#qs.getTagValue( dataSetWithTags, REFRESH_TYPE_TAG_PREFIX + suffix );
    const interval = this.#qs.getTagValue( dataSetWithTags, REFRESH_INTERVAL_TAG_PREFIX + suffix);    
    return { refreshType: type, refreshInterval: interval };
  }

  async activateScheduling( ) {
    await this.#doForEachScheduleSupportingDataSet(
      async (dataSetWithTags) => {
        const refreshParamsArray = this.#defineScheduling( dataSetWithTags );
        for( const refreshParams of refreshParamsArray ) {
          await this.#qs.createRefreshSchedule( dataSetWithTags, refreshParams )
        }
      }
    )
  }

  async deactivateScheduling( ) {
    await this.#doForEachScheduleSupportingDataSet(
      async (dataSetWithTags) => {
        for( let index = 0; index < MAX_REFRESH_SCHEDULER_QUANTITY; index += 1 ) {
          await this.#qs.deleteRefreshSchedule( dataSetWithTags, index )
        }
      }
    )
  }
   
}