import { DescribeStatementCommandOutput, RedshiftData } from '@aws-sdk/client-redshift-data';
import { StatementError } from './StatementError';

function assertNotEmpty( val: string | undefined, name: string) {
  
  if ( !val || ( typeof val == "string" && !val.trim()) ) {
    const message = name + " can't be empty";
    console.error(message);
    throw new Error(message);
  }
  return val;
}

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

  async executeSqlStatementWithData( sql: string ) {
  
    let statusResult = await this.executeSqlStatement( sql );
    const recordsResult = await this.#redshift.getStatementResult({ Id: statusResult.Id });
    return recordsResult;
  }
  
  async executeSqlStatement( sql: string) {
    
    const executeStatementCommand = await this.#redshift.executeStatement({
      ClusterIdentifier: this.#redshiftClusterIdentifier,
      Database: this.#redshiftDatabaseName,
      DbUser: this.#redshiftDatabaseUserName,
      Sql: sql,
    });
    
    let statementId = executeStatementCommand.Id;
    
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
