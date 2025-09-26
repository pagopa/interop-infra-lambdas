
export type RedshiftEvent = {
  code: string,
  cluster: string | null,
  description: string | null,
  timestamp: string | null
}

export type OnOffAction = "ON" | "OFF";

const eventCodeToAction : { [ key: string]: OnOffAction } = {
  "REDSHIFT-EVENT-3622": "ON", // [Amazon Redshift INFO] - Resume Succeeded.
  "REDSHIFT-EVENT-3618":  "OFF" // [Amazon Redshift INFO] - Pause Started.
}

export class RedshiftSnsEventDecoder {

  #redshiftEvents: RedshiftEvent[]

  constructor( lambdaEvent: unknown ) {
    this.#redshiftEvents = this.#listRedshiftEvents( lambdaEvent );
  }

  getRedshiftEvents() {
    return this.#redshiftEvents;
  }

  getScheduleAction(): OnOffAction | null {
    const actionsArray = this.#redshiftEvents
      .map( (redshiftEvt) => eventCodeToAction[ redshiftEvt.code] ) // - map event code to action
      .filter( (action) => action ) // - keep only successful mapping
      ;
    
    const actionsQuantity = actionsArray.length;
    const actionToBeDone = actionsQuantity > 0 ? actionsArray[ actionsQuantity - 1] : null;
    return actionToBeDone;
  }

  #listRedshiftEvents( lambdaEvent: unknown ): RedshiftEvent[] {
    const lambdaEventIsObject = (
        typeof lambdaEvent === 'object' 
      && 
        !Array.isArray(lambdaEvent) 
      && 
        lambdaEvent
    );
    
    const result = lambdaEventIsObject ? 
                            this.#listRedshiftEventsFromObject( lambdaEvent as object) : [];
    return result;
  }

  #listRedshiftEventsFromObject( lambdaEvent: object ): RedshiftEvent[] {
    const result: RedshiftEvent[] = [];

    if( 'Records' in lambdaEvent && Array.isArray( lambdaEvent['Records'] )) {
      const records = lambdaEvent['Records'];
      for( const record of records ) {
        const redshiftEvent = this.#decodeSingleRecord( record );
        if( redshiftEvent ) {
          result.push( redshiftEvent );
        }
      }
    }

    return result;
  }

  #decodeSingleRecord(record: object): RedshiftEvent | null {
    let code = null;
    let description = null;
    let cluster = null;
    let timestamp = null;
    
    if( 'Sns' in record ) {
      const snsEvent = record.Sns;
      
      if( snsEvent && typeof snsEvent === 'object') {
        
        if( 'Message' in snsEvent ) {
          let snsMessage = null;
          try {
            snsMessage = JSON.parse( '' + snsEvent.Message )
          }
          catch( error ) {
            console.warn(" ==== ERROR \n" + error + "\n parsing JSON message:\n" + snsEvent.Message );
          }

          if( snsMessage ) {
            if( 'Resource' in snsMessage && snsMessage.Resource ) {
              cluster = ('' + snsMessage.Resource).trim();
            }
            if( 'About this Event' in snsMessage) {
              code = ('' + snsMessage['About this Event']).replace(/.*#/, '').trim();
            }
            if( 'Event Time' in snsMessage && snsMessage['Event Time']) {
              timestamp = ('' + snsMessage['Event Time']).trim();
            }
          }
        }
        
        if('Subject' in snsEvent && snsEvent.Subject) {
          description = ('' + snsEvent.Subject).trim();
        }
      }
    }

    const result = code ? { code, cluster, description, timestamp } : null;
    return result;
  }
}
