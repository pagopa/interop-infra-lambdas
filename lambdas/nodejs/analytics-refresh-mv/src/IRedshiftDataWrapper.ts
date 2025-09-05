import { 
  DescribeStatementCommandOutput, 
  GetStatementResultCommandOutput 
} from '@aws-sdk/client-redshift-data';

/**
 * A generic object type where keys are strings and values are strings or undefined.
 * Used for SQL statement parameters.
 */
export type ObjectWithStringValues = { [key: string]: string | undefined };

/**
 * Defines the public contract for the RedshiftDataWrapper class.
 * This interface specifies methods for executing SQL statements against an
 * Amazon Redshift cluster using the Redshift Data API.
 */
export interface IRedshiftDataWrapper {

  /**
   * Executes a batch of SQL statements and retrieves the data for any that produce a result set.
   * @param statements An array of objects, each containing a SQL string and its parameters.
   * @returns A promise that resolves to an array of results. Each element corresponds to a
   * statement and is either a `GetStatementResultCommandOutput` or `null` if the statement
   * did not return a result set.
   */
  executeSqlStatementsWithData(
    statements: { sql: string, parameters: ObjectWithStringValues }[]
  ): Promise<(GetStatementResultCommandOutput | null)[]>;

  /**
   * Executes a single SQL statement and retrieves its result set.
   * @param sql The SQL query string to execute.
   * @param parameters An object containing the parameters for the SQL query.
   * @returns A promise that resolves to the `GetStatementResultCommandOutput` containing the query results.
   */
  executeSqlStatementWithData(
    sql: string, 
    parameters: ObjectWithStringValues
  ): Promise<GetStatementResultCommandOutput>;
  
  /**
   * Executes a batch of SQL statements and waits for completion, returning their final status.
   * This method does not fetch the result data.
   * @param statements An array of objects, each containing a SQL string and its parameters.
   * @returns A promise that resolves to the `DescribeStatementCommandOutput` with the final
   * status of the batch execution.
   */
  executeSqlStatements(
    statements: { sql: string, parameters: ObjectWithStringValues }[]
  ): Promise<DescribeStatementCommandOutput>;

  /**
   * Executes a single SQL statement and waits for completion, returning its final status.
   * This method does not fetch the result data.
   * @param sql The SQL query string to execute.
   * @param parameters An object containing the parameters for the SQL query.
   * @returns A promise that resolves to the `DescribeStatementCommandOutput` with the final
   * status of the statement execution.
   */
  executeSqlStatement(
    sql: string, 
    parameters: ObjectWithStringValues
  ): Promise<DescribeStatementCommandOutput>;
}
