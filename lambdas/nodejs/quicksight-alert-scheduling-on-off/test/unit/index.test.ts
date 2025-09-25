import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('should call activateScheduling when the action is "ON"', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: 'ON' } };

    // ACT: Execute the handler
    await handler(event);

    // ASSERT: Verify the correct functions were called
    expect(mockActivateScheduling).toHaveBeenCalledTimes(1);
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should call deactivateScheduling when the action is "OFF"', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: 'OFF' } };

    // ACT
    await handler(event);

    // ASSERT
    expect(mockDeactivateScheduling).toHaveBeenCalledTimes(1);
    expect(mockActivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the action is invalid', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: 'INVALID' } };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Action detail.schedule_action is an ON/OFF action, value 'INVALID' is not allowed");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the action is null', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: null } };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Action detail.schedule_action is an ON/OFF action, value 'null' is not allowed");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the action is a number', async () => {
    // ARRANGE
    const event = { detail: { schedule_action: 2 } };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Action detail.schedule_action is an ON/OFF action, value '2' is not allowed");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the action is not given', async () => {
    // ARRANGE
    const event = { detail: { } };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Action detail.schedule_action is an ON/OFF action, value 'undefined' is not allowed");

    // Ensure no scheduling methods were called in the error case
    expect(mockActivateScheduling).not.toHaveBeenCalled();
    expect(mockDeactivateScheduling).not.toHaveBeenCalled();
  });

  it('should throw an error if the event is empty', async () => {
    // ARRANGE
    const event = { };

    // ACT & ASSERT: Expect the handler's promise to be rejected with the error
    await expect(handler(event)).rejects.toThrow("Action detail.schedule_action is an ON/OFF action, value 'undefined' is not allowed");

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