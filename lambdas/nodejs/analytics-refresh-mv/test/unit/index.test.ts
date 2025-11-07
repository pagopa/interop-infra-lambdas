import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mocks Setup ---

// 1. Create a mock function for the method we need to simulate.
const mockExecuteMaterializedViewRefresh = vi.fn();

// 2. Mock the *entire* module.
// This factory function replaces the module's exports.
vi.mock('../../src/MaterializedViewRefresherLambda', () => {
  // Return the mock structure for the module's exports
  return {
    // Replace the exported class with a mock constructor
    MaterializedViewRefresherLambda: vi.fn().mockImplementation(() => {
      // Return an object that simulates the class *instance*
      return {
        executeMaterializedViewRefresh: mockExecuteMaterializedViewRefresh,
      };
    }),
  };
});

// 3. Import the mocked class (which is now our vi.fn() from above)
import { MaterializedViewRefresherLambda } from '../../src/MaterializedViewRefresherLambda';

// 4. Import the handler *after* all mocks are set up
let handler;

// 5. Create a typed reference to the mocked class constructor
const MaterializedViewRefresherLambdaMock = vi.mocked(
  MaterializedViewRefresherLambda
);

// --- Tests ---

describe('Lambda Handler', () => {
  const originalEnv = process.env;

  beforeEach( async () => {
    // Reset all mock states
    vi.clearAllMocks();

    // Set up a consistent process.env for the tests
    process.env = {
      ...originalEnv,
      DB_HOST: 'test-db.local',
    };

    // Provide a default successful return value for the method
    mockExecuteMaterializedViewRefresh.mockResolvedValue({
      statusCode: 200,
      body: 'Success',
    });

    // Import the handler here to ensure it gets the mocked dependencies
    const module = await import('../../src/index'); // Adjust path if needed
    handler = module['handler'];
  });

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv;
  });

  it('should instantiate MaterializedViewRefresherLambda with process.env', async () => {
    await handler();

    // Assert that our *mock constructor* was called with process.env
    // This proves the real constructor was never touched.
    expect(MaterializedViewRefresherLambdaMock).toHaveBeenCalledOnce();
    expect(MaterializedViewRefresherLambdaMock).toHaveBeenCalledWith(process.env);
  });

  it('should call executeMaterializedViewRefresh on the mock instance', async () => {
    await handler();

    // Assert that the method on the mock *instance* was called
    expect(mockExecuteMaterializedViewRefresh).toHaveBeenCalledOnce();
  });

  it('should return the successful result from executeMaterializedViewRefresh', async () => {
    const mockResult = { statusCode: 200, message: 'Refresh complete' };
    mockExecuteMaterializedViewRefresh.mockResolvedValue(mockResult);

    const result = await handler();

    expect(result).toBe(mockResult);
  });

  it('should propagate errors from executeMaterializedViewRefresh', async () => {
    const mockError = new Error('Database connection failed');
    mockExecuteMaterializedViewRefresh.mockRejectedValue(mockError);

    // Assert that the handler rejects with the same error
    await expect(handler()).rejects.toThrow(mockError);
  });
});