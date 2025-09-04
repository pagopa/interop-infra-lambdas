import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaterializedViewHelper, ViewAndLevel } from '../../src/MaterializedViewHelper';
import { RedshiftDataWrapper } from '../../src/RedshiftDataWrapper';
import { RedshiftClusterChecker } from '../../src/RedshiftClusterChecker';


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

const mockIsAvailable = vi.fn();
vi.mock('../../src/RedshiftClusterChecker', () => {
  return {
    RedshiftClusterChecker: vi.fn().mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    })),
  };
});


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
    handler = module['handler'];
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

  // --- HAPPY PATH TEST ---
  it('should execute all steps successfully in the correct order', async () => {
    // ARRANGE
    // 1. Set up environment variables
    process.env.VIEWS_SCHEMAS_NAMES = '["schema1", "schema2"]';
    process.env.PROCEDURES_SCHEMA = 'procs';
    process.env.REDSHIFT_CLUSTER_IDENTIFIER = 'test-cluster';
    process.env.REDSHIFT_DATABASE_NAME = 'test-db';
    process.env.REDSHIFT_DB_USER = 'test-user';

    // 2. Configure mock return values
    mockIsAvailable.mockResolvedValue(true);
    mockListStaleMaterializedViews.mockResolvedValue([...MOCK_VIEWS_LEVEL_1, ...MOCK_VIEWS_LEVEL_2]);
    mockGroupMaterializedViews.mockReturnValue([MOCK_VIEWS_LEVEL_1, MOCK_VIEWS_LEVEL_2]);
    mockRefreshOneMaterializedView.mockResolvedValue('refreshed');
    mockUpdateLastMvRefreshInfo.mockResolvedValue('updated');

    // ACT
    await handler();

    // ASSERT
    // Verify the sequence of calls
    expect(RedshiftDataWrapper).toHaveBeenCalledWith('test-cluster', 'test-db', 'test-user');
    expect(MaterializedViewHelper).toHaveBeenCalledWith(expect.any(RedshiftDataWrapper), ['schema1', 'schema2'], 'procs');
    expect(mockListStaleMaterializedViews).toHaveBeenCalledOnce();
    expect(mockGroupMaterializedViews).toHaveBeenCalledOnce();
    
    // Check that refresh was called for each view (3 views in total)
    expect(mockRefreshOneMaterializedView).toHaveBeenCalledTimes(3);
    expect(mockRefreshOneMaterializedView).toHaveBeenCalledWith('s1', 'view_a');
    expect(mockRefreshOneMaterializedView).toHaveBeenCalledWith('s1', 'view_b');
    expect(mockRefreshOneMaterializedView).toHaveBeenCalledWith('s2', 'view_c');
    
    expect(mockUpdateLastMvRefreshInfo).toHaveBeenCalledOnce();
  });

  // --- FAILURE SCENARIO TESTS ---
  it('should throw an error if a required environment variable is missing', async () => {
    // ARRANGE
    process.env.VIEWS_SCHEMAS_NAMES = '[]';
    process.env.PROCEDURES_SCHEMA = undefined;
    
    // ACT & ASSERT
    await expect(handler()).rejects.toThrow("Parameter 'PROCEDURES_SCHEMA' is required.\nundefined");
  });
  
  it('should throw if listing stale views fails', async () => {
    // ARRANGE
    process.env.VIEWS_SCHEMAS_NAMES = '[]';
    process.env.PROCEDURES_SCHEMA = 'procs';
    const listError = new Error('Redshift API error');
    mockIsAvailable.mockResolvedValue(true);
    mockListStaleMaterializedViews.mockRejectedValue(listError);

    // ACT & ASSERT
    await expect(handler()).rejects.toThrow("Error listing materialized views\nError: Redshift API error");
  });

  it('should throw if refreshing a view fails', async () => {
    // ARRANGE
    process.env.VIEWS_SCHEMAS_NAMES = '[]';
    process.env.PROCEDURES_SCHEMA = 'procs';
    const refreshError = new Error('Timeout while refreshing');
    mockIsAvailable.mockResolvedValue(true);
    mockListStaleMaterializedViews.mockResolvedValue([ ...MOCK_VIEWS_LEVEL_1 ]);
    mockGroupMaterializedViews.mockReturnValue([MOCK_VIEWS_LEVEL_1]); // Provide views to refresh
    mockRefreshOneMaterializedView.mockRejectedValue(refreshError);

    // ACT & ASSERT
    await expect(handler()).rejects.toThrow("Error refreshing views\nError: Timeout while refreshing");
  });
  
  it('should throw if updating the last refresh info fails', async () => {
    // ARRANGE
    
    process.env.VIEWS_SCHEMAS_NAMES = '["a"]';
    process.env.PROCEDURES_SCHEMA = 'procs';
    const updateError = new Error('Cannot update table');
    mockIsAvailable.mockResolvedValue(true);
    mockListStaleMaterializedViews.mockResolvedValue([]);
    mockGroupMaterializedViews.mockReturnValue([]); // No views to refresh, proceed to final step
    mockUpdateLastMvRefreshInfo.mockRejectedValue(updateError);

    // ACT & ASSERT
    await expect(handler()).rejects.toThrow('Error refreshing information about materialized views refresh\nError: Cannot update table');
  });
});
