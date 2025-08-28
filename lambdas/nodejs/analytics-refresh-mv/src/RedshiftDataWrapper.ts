import { GetStatementResultCommandOutput, RedshiftData, SqlParameter } from '@aws-sdk/client-redshift-data';
import { StatementError } from './StatementError';
import { assertNotEmpty } from './utils';

export type ObjectWithStringValues = { [key:string]: string | undefined };

export class RedshiftDataWrapper {
  
  #redshift: RedshiftData;
  #redshiftClusterIdentifier: string;
  #redshiftDatabaseName: string;
  #redshiftDatabaseUserName: string;

  constructor(
      redshiftClusterIdentifier: string | undefined, 
      redshiftDatabaseName: string | undefined, 
      redshiftDatabaseUserName: string | undefined
    ) 
  {
    this.#redshiftClusterIdentifier = assertNotEmpty( redshiftClusterIdentifier, "redshiftClusterIdentifier" );
    this.#redshiftDatabaseName = assertNotEmpty( redshiftDatabaseName, "redshiftDatabaseName" );
    this.#redshiftDatabaseUserName = assertNotEmpty( redshiftDatabaseUserName, "redshiftDatabaseUserName" );
    this.#redshift = new RedshiftData({});

  }
  
  async executeSqlStatementsWithData( statements: { sql: string, parameters: ObjectWithStringValues}[] ) {
    const results: (GetStatementResultCommandOutput | null)[] = [];

    const statusResult = await this.executeSqlStatements( statements );
    for ( const subStatement of statusResult.SubStatements || []) {
      let result;
      if ( subStatement.HasResultSet ) {
        result = await this.#redshift.getStatementResult({ Id: subStatement.Id });
      }
      else {
        result = null;
      }
      results.push( result );
    }
    
    return results;
  }

  async executeSqlStatementWithData( sql: string, parameters: ObjectWithStringValues ) {
  
    const statusResult = await this.executeSqlStatement( sql, parameters );
    const recordsResult = await this.#redshift.getStatementResult({ Id: statusResult.Id });
    return recordsResult;
  }
  
  async executeSqlStatements( statements: { sql: string, parameters: ObjectWithStringValues}[] ) {
    // - Do not have a wayto insert parameters :(
    //   https://docs.aws.amazon.com/redshift-data/latest/APIReference/API_BatchExecuteStatement.html
    const sqls = statements.map( 
      statement => substituteParameters( statement.sql, statement.parameters )
    );

    const executeStatementCommand = await this.#redshift.batchExecuteStatement({
      ClusterIdentifier: this.#redshiftClusterIdentifier,
      Database: this.#redshiftDatabaseName,
      DbUser: this.#redshiftDatabaseUserName,
      Sqls: sqls,
    });
    
    const statementId = executeStatementCommand.Id;
    if (! statementId ) {
      throw new Error('error retrieving statement id');
    }

    return await this.#waitStatement( statementId );
}

  async executeSqlStatement( sql: string, parameters: ObjectWithStringValues) {
    
    const executeStatementCommand = await this.#redshift.executeStatement({
      ClusterIdentifier: this.#redshiftClusterIdentifier,
      Database: this.#redshiftDatabaseName,
      DbUser: this.#redshiftDatabaseUserName,
      Sql: sql,
      Parameters: objectToStatementParameters( parameters)
    });
    
    const statementId = executeStatementCommand.Id;
    if (! statementId ) {
      throw new Error('error retrieving statement id');
    }

    return await this.#waitStatement( statementId );
  }

  async #waitStatement( statementId: string ) {
    
    let statusResult;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      statusResult = await this.#redshift.describeStatement({ Id: statementId });
    } 
    while (statusResult.Status === 'STARTED' || statusResult.Status === 'SUBMITTED');

    if (statusResult.Status === 'FAILED') {
      throw new StatementError("SQL statement failed", statusResult);
    }
    return statusResult;
  }
}

function objectToStatementParameters( paramsObj: ObjectWithStringValues ) {
  const result: SqlParameter[] = [];
  for( const key of Object.keys( paramsObj )) {
    result.push({ name: key, value: paramsObj[key] })
  }
  return result;
}

// - ExecuteBatchStatement Do not have a way to insert parameters :(
//   https://docs.aws.amazon.com/redshift-data/latest/APIReference/API_BatchExecuteStatement.html
function substituteParameters( sql: string, paramsObj: ObjectWithStringValues ) {

  let sqlWithEscapedParameters = sql;
  for( const key of Object.keys( paramsObj )) {
    const val = "" + paramsObj[key];
    const escapedVal = val.replace(/'/g, "''");
    sqlWithEscapedParameters = sqlWithEscapedParameters.replace( new RegExp( ":" + key + " "), `'${escapedVal}' `)
  }

  return sqlWithEscapedParameters;
}
