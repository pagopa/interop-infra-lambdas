import { ViewAndLevel } from "./ViewAndLevel";

type RefreshFrequencyFilter = {
  minimumRefreshDelaySeconds: number
}

export class StaleMaterializedViewFilter {
  
  #incrementalRefreshFilter: RefreshFrequencyFilter;
  #notIncrementalRefreshFilter: RefreshFrequencyFilter;

  constructor( env: NodeJS.ProcessEnv ) {
    console.log("Configuring filters:")
    
    this.#incrementalRefreshFilter = this.#configureFilter( env, "INCREMENTAL_MV_MIN_INTERVAL" );
    console.log(" - Incremental views min delay:", this.#incrementalRefreshFilter)

    this.#notIncrementalRefreshFilter = this.#configureFilter( env, "NOT_INCREMENTAL_MV_MIN_INTERVAL" );
    console.log(" - Not incremental views min delay:", this.#notIncrementalRefreshFilter)
  }

  #configureFilter( env: NodeJS.ProcessEnv, name: string ) {
    let filter: RefreshFrequencyFilter;

    const envValue = env[ name ];
    if ( envValue ) {
      const intValue = (+ envValue)
      if( !isNaN( intValue ) ) {
        filter = { minimumRefreshDelaySeconds: intValue }
      }
      else {
        const msg = "Error parsing " + name + " environment variable: " + envValue + " is not parsable as integer";
        console.error( msg );
        throw new Error(msg );
      }
    }
    else {
      filter = { minimumRefreshDelaySeconds: 0 }
    }

    return filter;
  }

  async filterAll(
    materializedViewList: ViewAndLevel[], 
    removeListener: (( mv: ViewAndLevel|null, r: number ) => void) | null = null
  ) {
    const filteredList = [];
    
    const nowEpoch = this.#currentUtcEpochSeconds();
    console.log(" - Filtering using epoch " + nowEpoch );

    let removed = 0;
    for( const mv of materializedViewList ) {
      const keep = await this.#testOne( mv, nowEpoch );
      if( keep ) {
        filteredList.push( mv );
      }
      else {
        console.log(" - Not refreshing materialized view ", mv)
        if( removeListener ) {
          removeListener( mv, removed )
        }
        removed += 1;
      }
    }
    
    if( removeListener ) {
      removeListener( null, removed );
    }
    
    console.log("Removed "+ removed + " views.");
    return filteredList;
  }
  
  #currentUtcEpochSeconds() {
    return Math.ceil( new Date().getTime() / 1000 );
  }

  #testOne( el: ViewAndLevel, nowEpoch: number ): boolean {
    let result: boolean;
    if( el.incrementalRefreshNotSupported ) {
      result = this.#applyFilter( el, this.#notIncrementalRefreshFilter, nowEpoch );
    }
    else {
      result = this.#applyFilter( el, this.#incrementalRefreshFilter, nowEpoch );
    }
    return result;
  }

  #applyFilter( el: ViewAndLevel, filter: RefreshFrequencyFilter, nowEpoch: number): boolean {
    const lastRefreshLimit = nowEpoch - filter.minimumRefreshDelaySeconds;

    return el.lastRefreshEndTimeEpoch < lastRefreshLimit;
  }

}