import { 
    QuickSightClient, 
    ListDataSetsCommand, 
    DataSetSummary, 
    CreateRefreshScheduleCommand, 
    ListTagsForResourceCommand, 
    IngestionType, 
    DeleteRefreshScheduleCommand, 
    CreateRefreshScheduleRequest
} from "@aws-sdk/client-quicksight";
import { AwsStsWrapper } from "./AwsStsWrapper";

export type DataSetSummaryWithTags = DataSetSummary & { tags:{ [key: string]: string | undefined }}

export class AwsQuickSightWrapper {
  
  #quicksight: QuickSightClient;
  #sts: AwsStsWrapper;

  constructor() {
    this.#quicksight = new QuickSightClient();
    this.#sts = new AwsStsWrapper();;
  }

  async #listAllDataSets() {
    try {
      const allDataSets = [];
      
      console.log(` - Listing datasets`);
      let nextToken;
      do {
        const command: ListDataSetsCommand = new ListDataSetsCommand({
          AwsAccountId: await this.#sts.getAwsAccountId(),
          NextToken: nextToken,
        });
        const response = await this.#quicksight.send(command);
      
        if (response.DataSetSummaries) {
          allDataSets.push(...response.DataSetSummaries);
        }
        
        nextToken = response.NextToken;
        console.log(`   . every dot is a result page`);
      } while (nextToken);

      console.log(`  Found a total of ${allDataSets.length} datasets.`);
      return allDataSets;
    } 
    catch (error) {
      console.error("ERROR: Failed to list datasets:", error);
      throw error;
    }
  }

  async #isSpiceDataSet(  dataSet: DataSetSummary) {
    return dataSet.ImportMode === "SPICE"    
  }

  async listScheduleSupportingDataSets(): Promise<DataSetSummaryWithTags[]> {
    const allDatasets = await this.#listAllDataSets();
    const spiceDatasets = allDatasets.filter(
      (dataSet) => this.#isSpiceDataSet( dataSet)
    )

    const tagsEnricherPromises = spiceDatasets.map( 
      (dataSet) => this.#enrichWithTags( dataSet )
    );

    return Promise.all( tagsEnricherPromises );
  }

  async #enrichWithTags( dataSetSummary: DataSetSummary): Promise<DataSetSummaryWithTags> {
    try { 
      const dataSetArn = dataSetSummary.Arn;

      const response = await this.#quicksight.send(
        new ListTagsForResourceCommand({ ResourceArn: dataSetArn })
      );
      
      const tags = fromKeyValueArrayToObject( response.Tags || [] )
      const result = { ... dataSetSummary, tags }
      return result;
      
    } catch (error) {
      console.error(` ERROR: Failed to get tags for '${dataSetSummary.Arn}':`, error);
      throw error;
    }
  }

  getTagValue( dataSetWithTag: DataSetSummaryWithTags, tagName: string ) {
    return dataSetWithTag.tags[ tagName ];
  }

  async createRefreshSchedule( datasetSummary: DataSetSummary, refreshType: string ) {
    const dataSetId = datasetSummary.DataSetId;

    if( ![ "INCREMENTAL_REFRESH", "FULL_REFRESH"].includes( refreshType )) {
      const msg = "refresh type not supported: " + refreshType + " on dataset " + datasetSummary.Arn;
      console.error( msg );
      throw new Error( msg );
    }

    try {
      const scheduleConfig : CreateRefreshScheduleRequest = { 
        AwsAccountId: await this.#sts.getAwsAccountId(),
        DataSetId: dataSetId,
        Schedule: {
          ScheduleId: dataSetId + "-schedule",
          ScheduleFrequency: {
            Interval: (refreshType as IngestionType) == "INCREMENTAL_REFRESH" ? "MINUTE15" : "HOURLY"
          },
          RefreshType: (refreshType as IngestionType)
        }
      }

      await this.#quicksight.send( new CreateRefreshScheduleCommand( scheduleConfig ) );

      console.log(` - Successfully applied schedule to '${datasetSummary.Arn}'. Schedule data:\n`, scheduleConfig );
    } 
    catch (error: unknown) {
      const errorName = ( error as { name?: string})?.name;
      if ( errorName === "ResourceExistsException") {
        console.warn(` - Schedule for '${datasetSummary.Arn}' already exists` );
      }
      else {
        console.error(` ERROR: Failed to create scheduling for dataset '${datasetSummary.Arn}':`, error);
        throw error;
      }
    }
  }

  async deleteRefreshSchedule( datasetSummary: DataSetSummary ) {
    const dataSetId = datasetSummary.DataSetId;

    try {
      await this.#quicksight.send(
        new DeleteRefreshScheduleCommand({ 
          AwsAccountId: await this.#sts.getAwsAccountId(),
          DataSetId: dataSetId,
          ScheduleId: dataSetId + "-schedule"
        })
      );

      console.log(` - Successfully removed schedule to '${datasetSummary.Arn}'.`);
    } catch (error: unknown) {
      const errorName = ( error as { name?: string})?.name;
      if ( errorName === "ResourceNotFoundException") {
        console.warn(` - Schedule for '${datasetSummary.Arn}' is not present, so delete is skipped`);
      }
      else {
        console.error(` ERROR: Failed to update '${datasetSummary.Arn}':`, error);
        throw error;
      }
    }
  }

}


type KeyValue = { Key: string | undefined, Value: string | undefined}

function fromKeyValueArrayToObject( arr: KeyValue[]) {
  const result: { [key: string]: string | undefined } = {};
  for( const element of arr ) {
    if( element.Key ) {
      result[ element.Key ] = element.Value
    }
  }
  return result;
}
