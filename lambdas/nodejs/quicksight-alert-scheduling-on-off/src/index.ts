import { QuickSightAlertScheduler } from "./QuickSightAlertScheduler";


type OnOffAction = "ON" | "OFF";

function checkOnOffAction( actionValue: string, actionName: string ): OnOffAction {
  let result: OnOffAction;
  if( "ON" === actionValue ) {
    result = "ON";
  }
  else if( "OFF" === actionValue ) {
    result = "OFF";
  }
  else {
    throw new Error(`Action ${actionName} is an ON/OFF action, value '${actionValue}' is not allowed`)
  }
  return result;
}

type InputTypeEvent = { 
  "detail": { 
    "schedule_action": string // Allowed 'ON' or 'OFF'
  }
}


exports.handler = async function ( event: InputTypeEvent ) {
  
  const scheduleAction = checkOnOffAction( event?.detail?.schedule_action, "details.schedule_action" )

  const dataSetsScheduler = new QuickSightAlertScheduler();
  
  switch( scheduleAction ) {
    case "ON": dataSetsScheduler.activateScheduling(); break;
    case "OFF": dataSetsScheduler.deactivateScheduling(); break;
  }
}
