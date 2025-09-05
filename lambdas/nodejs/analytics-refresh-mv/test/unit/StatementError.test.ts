import { describe, it, expect } from 'vitest';
import { StatementError } from '../../src/StatementError';
import { DescribeStatementCommandOutput } from '@aws-sdk/client-redshift-data';

describe('StatementError', () => {
  // ARRANGE: Create a mock object that mimics the structure of DescribeStatementCommandOutput.
  const mockStatementInfo: DescribeStatementCommandOutput = {
    Id: 'mock-id-12345',
    Status: 'FAILED',
    Error: 'Syntax error at or near "SELECTT"',
    $metadata: {
      httpStatusCode: 400,
    },
  };

  it('should correctly set the error message and store the info object', () => {
    // ARRANGE
    const errorMessage = 'SQL statement failed';

    // ACT: Create an instance of the custom error.
    const statementError = new StatementError(errorMessage, mockStatementInfo);

    // ASSERT
    // 1. Check if the error message is set correctly on the parent Error class.
    expect(statementError.message).toBe(errorMessage);
    
    // 2. Check if the instance is of the correct type.
    expect(statementError).toBeInstanceOf(Error);
    expect(statementError).toBeInstanceOf(StatementError);
  });

  it('should override toString() to include the stringified info object', () => {
    // ARRANGE
    const errorMessage = 'SQL statement failed';

    // ACT
    const statementError = new StatementError(errorMessage, mockStatementInfo);
    const errorString = statementError.toString();

    // ASSERT
    // 1. Check that the output starts with the standard error string.
    expect(errorString).toContain(`Error: ${errorMessage}`);
    
    // 2. Check that the output includes the JSON representation of the info object.
    const expectedJson = JSON.stringify(mockStatementInfo, null, 2);
    expect(errorString).toContain(expectedJson);
    
    // 3. Check the overall structure.
    expect(errorString).toBe(`Error: ${errorMessage}\n${expectedJson}`);
  });
});
