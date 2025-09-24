import { AwsQuickSightWrapper } from "./AwsQuickSightWrapper";
import { AwsStsWrapper } from "./AwsStsWrapper";
import { QuickSightAlertScheduler } from "./QuickSightAlertScheduler";
import { checkOnOffAction } from "./utils";


type InputTypeEvent = { 
  "detail": { 
    "schedule_action": string // Allowed 'ON' or 'OFF'
  }
}


exports.handler = async function ( event: InputTypeEvent ) {
  if( ! event ) {
    throw new Error("Event null or undefined is not allowed")
  }
  
  const scheduleAction = checkOnOffAction( event.detail?.schedule_action, "details.schedule_action" )

  const sts = new AwsStsWrapper();
  const qs = new AwsQuickSightWrapper( sts );
  const dataSetsScheduler = new QuickSightAlertScheduler( qs );
  
  switch( scheduleAction ) {
    case "ON": dataSetsScheduler.activateScheduling(); break;
    case "OFF": dataSetsScheduler.deactivateScheduling(); break;
  }
}
