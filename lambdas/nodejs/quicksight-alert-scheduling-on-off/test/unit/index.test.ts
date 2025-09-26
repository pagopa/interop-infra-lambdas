import { describe, it, expect, vi, beforeEach } from 'vitest';

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// --- 1. Mock all dependencies ---
// We mock every imported module to control its behavior and isolate the handler.

// Mock the scheduler class and its methods
const mockActivateScheduling = vi.fn();
const mockDeactivateScheduling = vi.fn();
vi.mock('../../src/QuickSightAlertScheduler', () => {
  // The mock constructor returns an object with our spy methods
  return {
    QuickSightAlertScheduler: vi.fn().mockImplementation(() => ({
      activateScheduling: mockActivateScheduling,
      deactivateScheduling: mockDeactivateScheduling,
    })),
  };
});

// Mock the wrapper classes with simple empty mocks since we just need to
// ensure they can be instantiated without running real code.
vi.mock('./AwsQuickSightWrapper', () => ({ default: vi.fn() }));
vi.mock('./AwsStsWrapper', () => ({ default: vi.fn() }));

// --- 2. Import the handler after mocks are defined ---
const { handler } = await import('../../src/index');

// --- 3. Write the test suite ---
describe('Lambda Handler', () => {
  // Before each test, reset the call history of all mocks for isolation
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call activateScheduling when the event is "REDSHIFT-EVENT-3622"', async () => {
    // ARRANGE
    const event = { Records: [{ Sns: { Message: "{ \"About this Event\": \"#REDSHIFT-EVENT-3622\" }" }}] };

    // ACT: Execute the handler
    const result = await handler(event);

    // ASSERT: Verify the correct functions were called
    expect(result).toBe("ON");
    expect(mockActivateScheduling).toHaveBeenCalledTimes(1);
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should call deactivateScheduling when the event is "REDSHIFT-EVENT-3618"', async () => {
    // ARRANGE
    const event = { Records: [{ Sns: { Message: "{ \"About this Event\": \"#REDSHIFT-EVENT-3618\" }" }}] };

    // ACT
    const result = await handler(event);

    // ASSERT
    expect(result).toBe("OFF");
    expect(mockDeactivateScheduling).toHaveBeenCalledTimes(1);
    expect(mockActivateScheduling).not.toHaveBeenCalled();
  });

  it('should call do nothing if event is not "REDSHIFT-EVENT-3618" or "REDSHIFT-EVENT-3622"', async () => {
    // ARRANGE
    const event = { Records: [{ Sns: { Message: "{ \"About this Event\": \"#REDSHIFT-EVENT-3600\" }" }}] };

    // ACT
    const result = await handler(event);

    // ASSERT
    expect(result).toBe("NONE");
    expect(mockDeactivateScheduling).not.toHaveBeenCalledTimes(1);
    expect(mockActivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the lambda event do not contain redshift events', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: 'INVALID' } };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Lambda event do not contain redshift events");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the event is undefined or null', async () => {
    // ARRANGE
    const event = undefined;

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Event null or undefined is not allowed");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });
});