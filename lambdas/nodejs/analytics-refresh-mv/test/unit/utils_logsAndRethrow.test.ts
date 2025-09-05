import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  logAndRethrow
} from '../../src/utils'; // Assuming your functions are in 'utils.ts'

// N.B.: this tests are in an isolated file because other tests interfere 
//       with assertions on consoleErrorSpy.

// --------------- Test for utility function logAndRethrow ------------------
let consoleErrorSpy;

describe('logAndRethrow', () => {
  
  // Reset the spy before each test to ensure call counts are isolated.
  beforeEach(() => {
    // Create a spy on console.error to track its calls without logging to the console.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleErrorSpy.mockClear();
  });

  // Restore the original console.error function after all tests in this block are done.
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should log the message and the error, and return a combined Error object', () => {
    // ARRANGE
    const message = 'An unexpected error occurred';
    const originalError = new Error('Database connection failed');

    // ACT
    const newError = logAndRethrow(message, originalError);

    // ASSERT
    // 1. Verify that console.error was called correctly.
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(originalError);

    // 2. Verify the new Error object has the correct combined message.
    expect(newError).toBeInstanceOf(Error);
    expect(newError.message).toBe(`${message}\n${originalError.toString()}`);
  });

  it('should handle a string as the error input', () => {
    // ARRANGE
    const message = 'Processing failed';
    const errorString = 'Invalid input data';

    // ACT
    const newError = logAndRethrow(message, errorString);

    // ASSERT
    // 1. Verify logging.
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(errorString);
    
    // 2. Verify the new Error object's message.
    expect(newError.message).toBe(`${message}\n${errorString}`);
  });
});
