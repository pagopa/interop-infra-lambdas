import { MaterializedViewRefresherLambda } from './MaterializedViewRefresherLambda';

exports.handler = async function () {
  
  const handlerObj = new MaterializedViewRefresherLambda( process.env );
  return handlerObj.executeMaterializedViewRefresh();
};


