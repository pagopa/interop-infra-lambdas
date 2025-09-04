import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaterializedViewHelper, ViewAndLevel } from '../../src/MaterializedViewHelper';
import { RedshiftDataWrapper } from '../../src/RedshiftDataWrapper';

// N.B.: This file is separated from index.test.ts because the use of mockImplementation 
//       on RedshiftDataWrapper and MaterializedViewHelper interfere with others tests.

// --- MOCK SETUP ---

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock all dependencies before they are imported by the handler.

// 1. Mock the grouping function
const mockGroupMaterializedViews = vi.fn();
vi.mock('../../src/groupMaterializedViews', () => ({
  groupMaterializedViews: mockGroupMaterializedViews,
}));

// 2. Mock the wrapper classes and their methods
vi.mock('../../src/RedshiftDataWrapper', );

const mockListStaleMaterializedViews = vi.fn();
const mockRefreshOneMaterializedView = vi.fn();
const mockUpdateLastMvRefreshInfo = vi.fn();
vi.mock('../../src/MaterializedViewHelper', () => {
  return {
    MaterializedViewHelper: vi.fn().mockImplementation(() => ({
      listStaleMaterializedViews: mockListStaleMaterializedViews,
      refreshOneMaterializedView: mockRefreshOneMaterializedView,
      updateLastMvRefreshInfo: mockUpdateLastMvRefreshInfo,
    })),
  };
});

process.env.VIEWS_SCHEMAS_NAMES = '[]';
process.env.PROCEDURES_SCHEMA = 'procs';
    
// --- TEST SUITE ---
describe('Lambda Handler', () => {
  // Store original process.env
  const originalEnv = process.env;

  // Dynamically import the handler AFTER mocks are set up
  let handler;

  beforeEach(async () => {
    // Reset all mocks and environment variables before each test
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Import the handler here to ensure it gets the mocked dependencies
    const module = await import('../../src/index'); // Adjust path if needed
    handler = module.handler;
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  // --- Mock Data ---
  const MOCK_VIEWS_LEVEL_1: ViewAndLevel[] = [
    { mvSchemaName: 's1', mvName: 'view_a', mvLevel: 1 },
    { mvSchemaName: 's1', mvName: 'view_b', mvLevel: 1 },
  ];
  const MOCK_VIEWS_LEVEL_2: ViewAndLevel[] = [
    { mvSchemaName: 's2', mvName: 'view_c', mvLevel: 2 },
  ];

  // --- INSTANTIATION FAILURE SCENARIO TESTS ---
  it('should throw an error if RedshiftDataWrapper cannot be instantiated', async () => {
    // ARRANGE
    const mockRedshiftDataWrapper = vi.mocked(RedshiftDataWrapper);
    mockRedshiftDataWrapper.mockImplementationOnce(() => {
      throw new Error("missing argument");
    });

    // ACT & ASSERT
    await expect(handler()).rejects.toThrow("Error creating RedshiftData client\nError: missing argument");
  });

  it('should throw an error if MaterializedViewHelper cannot be instantiated', async () => {
    // ARRANGE
    const mockMaterializedViewHelper = vi.mocked(MaterializedViewHelper);
    mockMaterializedViewHelper.mockImplementationOnce(() => {
      throw new Error("missing argument");
    });

    // ACT & ASSERT
    await expect(handler()).rejects.toThrow("Error creating MaterializedViewHelper client\nError: missing argument");
  });

});
