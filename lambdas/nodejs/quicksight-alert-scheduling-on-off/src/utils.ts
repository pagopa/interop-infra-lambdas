export type OnOffAction = "ON" | "OFF";

export function checkOnOffAction( actionValue: string, actionName: string ): OnOffAction {
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
