import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterializedViewHelper } from '../../src//MaterializedViewHelper';
import { RedshiftDataWrapper } from '../../src/RedshiftDataWrapper';
import { GetStatementResultCommandOutput } from '@aws-sdk/client-redshift-data';
import { ViewAndLevel } from '../../src/ViewAndLevel';

// --- Mock Setup ---
// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// Create mock functions for the methods we'll use from RedshiftDataWrapper
const mockExecuteSqlStatementsWithData = vi.fn();
const mockExecuteSqlStatement = vi.fn();

// Mock the entire RedshiftDataWrapper class
vi.mock('../../src/RedshiftDataWrapper', () => {
  // Return a mock constructor that creates an object with our mock methods
  return {
    RedshiftDataWrapper: vi.fn().mockImplementation(() => {
      return {
        executeSqlStatementsWithData: mockExecuteSqlStatementsWithData,
        executeSqlStatement: mockExecuteSqlStatement,
      };
    }),
  };
});

// Spy on console.log to keep test output clean and verify calls
vi.spyOn(console, 'log').mockImplementation(() => {});

// --- Test Suite ---
describe('MaterializedViewHelper', () => {
  let mockRedshiftWrapper: RedshiftDataWrapper;
  let helper: MaterializedViewHelper;

  const VIEWS_SCHEMAS = ['schema1', 'schema2'];
  const PROCEDURES_SCHEMA = 'procs';

  beforeEach(() => {
    // Clear any previous mock history
    vi.clearAllMocks();

    // Create a new mock instance for each test to ensure isolation
    mockRedshiftWrapper = new RedshiftDataWrapper('c', 'd', 'u');
    helper = new MaterializedViewHelper(
      mockRedshiftWrapper,
      VIEWS_SCHEMAS,
      PROCEDURES_SCHEMA
    );
  });

  describe('constructor', () => {
    it('should initialize correctly with valid parameters', () => {
      expect(helper).toBeInstanceOf(MaterializedViewHelper);
    });

    it('should throw an error if proceduresSchema is invalid (e.g., contains spaces)', () => {
      // This tests the internal call to `assertAlphanumericNotEmpty`
      expect(() => new MaterializedViewHelper(mockRedshiftWrapper, [], 'invalid schema'))
        .toThrow('proceduresSchema in not alphanumeric');
    });
  });

  describe('listStaleMaterializedViews', () => {
    it('should call the correct procedure and parse the results successfully', async () => {
      // ARRANGE: Define the mock response from Redshift
      const mockRedshiftResponse: (GetStatementResultCommandOutput | null)[] = [
        null, // Result of the CALL statement
        {     // Result of the SELECT statement
          Records: [
            [
              { stringValue: 'schema1' }, 
              { stringValue: 'mv_a' }, 
              { longValue: 1 }, 
              { booleanValue: true },
              { stringValue: "Start time" },
              { stringValue: "End time" },
              { longValue: 1000 },
              { longValue: 2000 },
            ],
            [
              { stringValue: 'schema2' }, 
              { stringValue: 'mv_b' }, 
              { longValue: 2 }, 
              { isNull: true },
              { isNull: true },
              { isNull: true },
              { isNull: true },
              { isNull: true },
            ],
          ],
          $metadata: {}
        },
      ];
      mockExecuteSqlStatementsWithData.mockResolvedValue(mockRedshiftResponse);

      // ACT
      const result = await helper.listStaleMaterializedViews();

      // ASSERT
      // 1. Check that the wrapper was called correctly
      expect(mockExecuteSqlStatementsWithData).toHaveBeenCalledOnce();
      const calledStatements = mockExecuteSqlStatementsWithData.mock.calls[0][0];
      expect(calledStatements[0].sql).toContain(`CALL "${PROCEDURES_SCHEMA}".list_stale_materialized_views`);
      expect(calledStatements[0].parameters.schemasList).toBe('schema1, schema2');
      expect(calledStatements[1].sql).toContain('SELECT\n            mv_schema, mv_name, mv_level');

      // 2. Check that the output is parsed correctly
      const expected: ViewAndLevel[] = [
        { 
          mvSchemaName: 'schema1', 
          mvName: 'mv_a', 
          mvLevel: 1, 
          incrementalRefreshNotSupported: true,
          lastRefreshStartTime: "Start time",
          lastRefreshStartTimeEpoch: 1000,
          lastRefreshEndTime: "End time",
          lastRefreshEndTimeEpoch: 2000,
        },
        { 
          mvSchemaName: 'schema2', 
          mvName: 'mv_b', 
          mvLevel: 2,
          incrementalRefreshNotSupported: false,
          lastRefreshStartTime: undefined,
          lastRefreshStartTimeEpoch: 0,
          lastRefreshEndTime: undefined,
          lastRefreshEndTimeEpoch: 0,
        },
      ];
      expect(result).toEqual(expected);
    });

    it('should return an empty array if Redshift returns no records', async () => {
      // ARRANGE
      mockExecuteSqlStatementsWithData.mockResolvedValue([null, { Records: [] }]);

      // ACT
      const result = await helper.listStaleMaterializedViews();

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should throw an error if a record is missing a required field', async () => {
      // ARRANGE: A record is missing the `longValue` for mvLevel
      const malformedResponse = [
        null,
        {
          Records: [[{ stringValue: 'schema1' }, { stringValue: 'mv_a' }, {}]],
        },
      ];
      mockExecuteSqlStatementsWithData.mockResolvedValue(malformedResponse);

      // ACT & ASSERT
      await expect(helper.listStaleMaterializedViews()).rejects.toThrow('some field is missing or null');
    });

    it('should throw an error if the list query do not return information', async () => {
      // ARRANGE: A record is missing the `longValue` for mvLevel
      const malformedResponse = [
        null,
      ];
      mockExecuteSqlStatementsWithData.mockResolvedValue(malformedResponse);

      // ACT & ASSERT
      await expect(helper.listStaleMaterializedViews()).rejects.toThrow('Listing query expected to return a result set');
    });

    it('should throw an error if the list query do not return a result set', async () => {
      // ARRANGE: A record is missing the `longValue` for mvLevel
      const malformedResponse = [
        null,
        null
      ];
      mockExecuteSqlStatementsWithData.mockResolvedValue(malformedResponse);

      // ACT & ASSERT
      await expect(helper.listStaleMaterializedViews()).rejects.toThrow('Listing query expected to return a result set');
    });
  });

  describe('refreshOneMaterializedView', () => {
    it('should call the refresh procedure with the correct schema and view name', async () => {
      // ARRANGE
      const schemaName = 'my_schema';
      const mvName = 'my_mv_name';

      // ACT
      await helper.refreshOneMaterializedView(schemaName, mvName);

      // ASSERT
      expect(mockExecuteSqlStatement).toHaveBeenCalledOnce();
      const expectedSql = `CALL "${PROCEDURES_SCHEMA}".refresh_materialized_view( :schemaName, :mvName );`;
      const expectedParams = { schemaName, mvName };
      expect(mockExecuteSqlStatement).toHaveBeenCalledWith(expectedSql, expectedParams);
    });
  });

  describe('updateLastMvRefreshInfo', () => {
    it('should call the update procedure with the correct list of schemas', async () => {
      // ARRANGE (Setup is done in beforeEach)
      
      // ACT
      await helper.updateLastMvRefreshInfo();

      // ASSERT
      expect(mockExecuteSqlStatement).toHaveBeenCalledOnce();
      const expectedSql = `CALL "${PROCEDURES_SCHEMA}".update_last_mv_refresh_info( :schemasList );`;
      const expectedParams = { schemasList: 'schema1, schema2' };
      expect(mockExecuteSqlStatement).toHaveBeenCalledWith(expectedSql, expectedParams);
    });
  });
});
