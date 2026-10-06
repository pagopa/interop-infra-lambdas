import { 
  AwsQuickSightWrapper, 
  DataSetSummaryWithTags,
  RefreshParameters,
  refreshParameterFactory
} from "./AwsQuickSightWrapper";
import { computeScheduleSuffix, getRandomFutureDate, intFromEnv } from './Utils'

const REFRESH_TYPE_TAG_PREFIX = process.env.REFRESH_TYPE_TAG_PREFIX ?? "RefreshType";
const REFRESH_INTERVAL_TAG_PREFIX = process.env.REFRESH_INTERVAL_TAG_PREFIX ?? "RefreshInterval";

const MAX_REFRESH_SCHEDULER_QUANTITY = 5;

export class QuickSightAlertScheduler {

  #qs: AwsQuickSightWrapper;
  #minRefreshSchduleOffset: number;
  #maxRefreshSchduleOffset: number;

  constructor( qs: AwsQuickSightWrapper ) {
    this.#qs = qs;
    this.#minRefreshSchduleOffset = intFromEnv("MIN_REFRESH_SCHEDULE_OFFSET_SECS") ?? 5 * 60;
    this.#maxRefreshSchduleOffset = intFromEnv("MAX_REFRESH_SCHEDULE_OFFSET_SECS") ?? 15 * 60;
    console.log("REFRESH_TYPE_TAG_PREFIX = " + REFRESH_TYPE_TAG_PREFIX);
    console.log("REFRESH_INTERVAL_TAG_PREFIX = " + REFRESH_INTERVAL_TAG_PREFIX);
    console.log("MAX_REFRESH_SCHEDULER_QUANTITY = " + MAX_REFRESH_SCHEDULER_QUANTITY);
    console.log("minRefreshSchduleOffset = " + this.#minRefreshSchduleOffset);
    console.log("maxRefreshSchduleOffset = " + this.#maxRefreshSchduleOffset);
  }

  async #doForEachScheduleSupportingDataSet( 
    actionLambda: (ds: DataSetSummaryWithTags) => Promise<void>
  ) {
    const dataSetsWithTags = await this.#qs.listScheduleSupportingDataSets();

    console.log( "DataSet that support alert check scheduling" );
    console.log( JSON.stringify( dataSetsWithTags, null, 2 ) );

    const dataSetsToBeModified = dataSetsWithTags.filter(
      (dataSetsWithTags) => this.#qs.hasTagsByRegexp( dataSetsWithTags, REFRESH_TYPE_TAG_PREFIX + "(_[2-5])?" )
    )

    console.log( "DataSet with RefreshType tag" );
    console.log( JSON.stringify( dataSetsToBeModified, null, 2 ) );

    const actionsPromises = dataSetsToBeModified.map( (ds) => actionLambda(ds) )
    for( const actionPromise of actionsPromises ) {
      await actionPromise;
    }
    //return await Promise.all( actionsPromises )
  }

  #defineScheduling( dataSetWithTags: DataSetSummaryWithTags ): RefreshParameters[] {
    const result: RefreshParameters[] = [];

    for( let index = 0; index < MAX_REFRESH_SCHEDULER_QUANTITY; index += 1 ) {
      const suffix = computeScheduleSuffix( index );

      const { refreshType, refreshInterval} = this.#refreshInfoFromTags( dataSetWithTags, suffix );
      
      if( refreshType ) {
        const scheduleParams = refreshParameterFactory( index, refreshType, refreshInterval );
        scheduleParams.whenStart = this.#getRandomScheduleOffset();
        result.push( scheduleParams );
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

  #getRandomScheduleOffset() {
    return getRandomFutureDate( this.#minRefreshSchduleOffset, this.#maxRefreshSchduleOffset );
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