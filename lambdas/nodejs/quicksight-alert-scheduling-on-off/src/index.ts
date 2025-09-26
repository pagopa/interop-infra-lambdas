import { AwsQuickSightWrapper } from "./AwsQuickSightWrapper";
import { AwsStsWrapper } from "./AwsStsWrapper";
import { QuickSightAlertScheduler } from "./QuickSightAlertScheduler";
import { RedshiftSnsEventDecoder } from "./RedshiftSnsEventDecoder";


type InputTypeEvent = { 
  "detail": { 
    "schedule_action": string // Allowed 'ON' or 'OFF'
  }
}


exports.handler = async function ( event: InputTypeEvent ) {
  console.log( " === Received Lambda Event: \n" + JSON.stringify( event, null, 2))
  if( ! event ) {
    throw new Error("Event null or undefined is not allowed")
  }

  const eventParser = new RedshiftSnsEventDecoder( event );
  const redshiftEvents = eventParser.getRedshiftEvents();
  console.log( " === Received Redshift Events: \n" + JSON.stringify( redshiftEvents, null, 2))

  if( redshiftEvents.length == 0 ) {
    throw new Error("Lambda event do not contain redshift events");
  }

  const scheduleAction = eventParser.getScheduleAction();
  console.log( " === Schedule Action to be done: " + scheduleAction )

  const sts = new AwsStsWrapper();
  const qs = new AwsQuickSightWrapper( sts );
  const dataSetsScheduler = new QuickSightAlertScheduler( qs );
  
  let actionDone;
  switch( scheduleAction ) {
    case "ON": 
      await dataSetsScheduler.activateScheduling(); 
      actionDone = "ON"; 
      break;
    case "OFF": 
      await dataSetsScheduler.deactivateScheduling(); 
      actionDone = "OFF"; 
      break;
    case null: 
      console.log("Nothing to do"); 
      actionDone = "NONE";
      break;
  }

  return actionDone;
}
