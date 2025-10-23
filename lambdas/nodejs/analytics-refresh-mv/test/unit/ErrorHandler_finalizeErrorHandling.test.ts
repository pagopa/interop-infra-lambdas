import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../../src/ErrorHandler';

let consoleErrorSpy;

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let mockAbortChecker = vi.fn();
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a fresh mock for the dependency
    mockAbortChecker = vi.fn();
    
    // Instantiate the class under test
    handler = new ErrorHandler(mockAbortChecker);

    // Create a spy on console.error to track its calls without logging to the console.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleErrorSpy.mockClear();
  });

  // --- Test finalizeErrorHandling ---

  describe('finalizeErrorHandling', () => {
    it('should do nothing if no errors were suppressed', () => {
      expect(() => handler.finalizeErrorHandling()).not.toThrow();
    });

    it('should throw and log all errors if errors were suppressed', async () => {
      const error1 = new Error('err 1');
      const msg1 = 'Message 1';
      const error2 = new Error('err 2');
      const msg2 = 'Message 2';

      // Setup: Suppress two errors
      mockAbortChecker.mockResolvedValue(null); // Make them non-aborting
      await handler.lenientErrorHandler(error1, msg1);
      await handler.lenientErrorHandler(error2, msg2);

      // Test: Run finalization
      expect(() => handler.finalizeErrorHandling())
        .toThrow('Previously suppressed errors are present!!!! See ERROR logs');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(8);
      expect(consoleErrorSpy).toHaveBeenCalledWith(msg1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(msg2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(msg1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(msg2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(error2);
    });
  });

});
