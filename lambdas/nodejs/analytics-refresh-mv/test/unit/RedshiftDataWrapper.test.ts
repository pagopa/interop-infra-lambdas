import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedshiftDataWrapper } from '../../src/RedshiftDataWrapper';
import { StatementError } from '../../src/StatementError';

// --- Mock Setup ---
// We create mock functions for each method on RedshiftData that our class uses.
const mockExecuteStatement = vi.fn();
const mockBatchExecuteStatement = vi.fn();
const mockDescribeStatement = vi.fn();
const mockGetStatementResult = vi.fn();

// We mock the entire module. This is the key to intercepting the `new RedshiftData()` call.
vi.mock('@aws-sdk/client-redshift-data', () => {
  // We provide a mock implementation for the RedshiftData class.
  const MockRedshiftData = vi.fn().mockImplementation(() => {
    return {
      executeStatement: mockExecuteStatement,
      batchExecuteStatement: mockBatchExecuteStatement,
      describeStatement: mockDescribeStatement,
      getStatementResult: mockGetStatementResult,
    };
  });
  
  // We must also export any other named exports our code uses from this module.
  return {
    RedshiftData: MockRedshiftData,
    // The actual constructors for commands are not needed, as they are not called directly in the mock.
  };
});


describe('RedshiftDataWrapper', () => {
  let wrapper: RedshiftDataWrapper;

  // Before each test, reset all mocks to ensure tests are isolated.
  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = new RedshiftDataWrapper('test-cluster', 'test-db', 'test-user');
  });

  // Test #1: Successful single statement execution
  it('should execute a single SQL statement and poll until FINISHED', async () => {
    // ARRANGE 
    // Mock the chain of AWS SDK calls
    mockExecuteStatement.mockResolvedValue({ Id: 'test-id-123' });
    mockDescribeStatement
      .mockResolvedValueOnce({ Status: 'SUBMITTED' }) // First poll
      .mockResolvedValueOnce({ Status: 'STARTED' })   // Second poll
      .mockResolvedValueOnce({ Status: 'FINISHED', Id: 'test-id-123' }); // Final poll

    // ACT
    const result = await wrapper.executeSqlStatement('SELECT 1;', { p1: 'val1' });

    // ASSERT
    expect(mockExecuteStatement).toHaveBeenCalledOnce();
    expect(mockExecuteStatement).toHaveBeenCalledWith({
      ClusterIdentifier: 'test-cluster',
      Database: 'test-db',
      DbUser: 'test-user',
      Sql: 'SELECT 1;',
      Parameters: [{ name: 'p1', value: 'val1' }],
    });

    expect(mockDescribeStatement).toHaveBeenCalledTimes(3);
    expect(mockDescribeStatement).toHaveBeenCalledWith({ Id: 'test-id-123' });
    expect(result.Status).toBe('FINISHED');
  });

  // Test #2: Handling a failed statement
  it('should throw a StatementError if the statement fails', async () => {
    // ARRANGE
    const failedStatus = { Status: 'FAILED', Error: 'Syntax Error' };
    mockExecuteStatement.mockResolvedValue({ Id: 'fail-id-456' });
    mockDescribeStatement
      .mockResolvedValueOnce({ Status: 'STARTED' })
      .mockResolvedValueOnce(failedStatus); // Final poll returns FAILED

    // ACT & ASSERT
    // We expect the promise to be rejected and throw a specific error.
    await expect(wrapper.executeSqlStatement('SELECT * FROM non_existent_table;', {}))
      .rejects.toThrow(StatementError);
      
    // You can also check the mock calls
    expect(mockExecuteStatement).toHaveBeenCalledOnce();
    expect(mockDescribeStatement).toHaveBeenCalledTimes(2);
  });

  // Test #3: Handling a statement without id
  it('should throw an Error if the statement has no id', async () => {
    // ARRANGE
    mockExecuteStatement.mockResolvedValue({ Id: '' });
    
    // ACT & ASSERT
    // We expect the promise to be rejected and throw a specific error.
    await expect(wrapper.executeSqlStatement('SELECT * FROM non_existent_table;', {}))
      .rejects.toThrow(Error);
      
    // You can also check the mock calls
    expect(mockExecuteStatement).toHaveBeenCalledOnce();
  });

  // Test #4: Handling a failed batch statement
  it('should throw an Error if the batch statement has no id', async () => {
    // ARRANGE
    mockBatchExecuteStatement.mockResolvedValue({ Id: '' });
    
    // ACT & ASSERT
    const statements = [
        { sql: 'SELECT * FROM logs WHERE id = :id ', parameters: { id: '123' } },
        { sql: "UPDATE users SET status = 'inactive' ", parameters: {} }
    ]

    // We expect the promise to be rejected and throw a specific error.
    await expect(wrapper.executeSqlStatements( statements ))
      .rejects.toThrow(Error);
      
    // You can also check the mock calls
    expect(mockBatchExecuteStatement).toHaveBeenCalledOnce();
  });

  // Test #5: Fetching data from a single statement
  it('should execute a statement and then fetch its results', async () => {
    // ARRANGE
    const finalStatus = { Status: 'FINISHED', Id: 'data-id-789' };
    const resultSet = { Records: [['test_user', 100]] };

    mockExecuteStatement.mockResolvedValue({ Id: 'data-id-789' });
    mockDescribeStatement.mockResolvedValue(finalStatus); // Polling finishes in one go
    mockGetStatementResult.mockResolvedValue(resultSet);

    // ACT
    const result = await wrapper.executeSqlStatementWithData('SELECT name, score FROM users;', {});

    // ASSERT
    expect(mockExecuteStatement).toHaveBeenCalledOnce();
    expect(mockDescribeStatement).toHaveBeenCalledOnce();
    expect(mockGetStatementResult).toHaveBeenCalledOnce();
    expect(mockGetStatementResult).toHaveBeenCalledWith({ Id: 'data-id-789' });
    expect(result).toEqual(resultSet);
  });
  
  // Test #6: Fetching data from a batch statement
  it('should execute a batch statement and fetch results only for statements that have them', async () => {
    // ARRANGE
    const batchId = 'batch-id-001';
    const subStatementIdWithResult = 'sub-id-001';
    const subStatementIdWithoutResult = 'sub-id-002';
    
    const finalBatchStatus = {
        Id: batchId,
        Status: 'FINISHED',
        SubStatements: [
            { Id: subStatementIdWithResult, HasResultSet: true },
            { Id: subStatementIdWithoutResult, HasResultSet: false }
        ]
    };
    const subStatementResult = { Records: [['some_data']] };

    mockBatchExecuteStatement.mockResolvedValue({ Id: batchId });
    mockDescribeStatement.mockResolvedValue(finalBatchStatus);
    mockGetStatementResult.mockResolvedValue(subStatementResult);

    const statements = [
        { sql: 'SELECT * FROM logs WHERE id = :id ', parameters: { id: '123' } },
        { sql: "UPDATE users SET status = 'inactive' ", parameters: {} }
    ];

    // ACT
    const results = await wrapper.executeSqlStatementsWithData(statements);

    // ASSERT
    expect(mockBatchExecuteStatement).toHaveBeenCalledOnce();
    // Check that parameter substitution happened correctly
    expect(mockBatchExecuteStatement).toHaveBeenCalledWith(expect.objectContaining({
      Sqls: [
        "SELECT * FROM logs WHERE id = '123' ",
        "UPDATE users SET status = 'inactive' "
      ]
    }));
    
    expect(mockDescribeStatement).toHaveBeenCalledOnce();
    expect(mockGetStatementResult).toHaveBeenCalledOnce(); // Crucially, only called once
    expect(mockGetStatementResult).toHaveBeenCalledWith({ Id: subStatementIdWithResult });

    // The final array should contain the result for the first statement and null for the second
    expect(results).toEqual([subStatementResult, null]);
  });
});