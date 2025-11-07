import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../../src/ErrorHandler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let mockAbortChecker = vi.fn();
  
  // We spy on console.error to ensure it's called without polluting test logs.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a fresh mock for the dependency
    mockAbortChecker = vi.fn();
    
    // Instantiate the class under test
    handler = new ErrorHandler(mockAbortChecker);
  });

  // --- Test lenientErrorHandler --
  describe('lenientErrorHandler', () => {
    it('should collect an error if it is not an abort error', async () => {
      const error = new Error('test error');
      const message = 'A lenient error occurred';
      
      // Setup: This error is NOT an abort error
      mockAbortChecker.mockResolvedValue(null);

      await handler.lenientErrorHandler(error, message);

      // Verify it checked the error
      expect(mockAbortChecker).toHaveBeenCalledWith(error);
      
      // Verify the error was collected for finalization
      expect(() => handler.finalizeErrorHandling())
        .toThrow('Previously suppressed errors are present!!!! See ERROR logs');
    });

    it('should throw an AbortError if it is an abort error', async () => {
      const error = new Error('critical error');
      const message = 'An aborting error occurred';
      const abortMessage = 'ABORT_MISSION';

      // Setup: This error IS an abort error
      mockAbortChecker.mockResolvedValue(abortMessage);

      const promise = handler.lenientErrorHandler(error, message);

      // Verify it throws the specific abort message
      await expect(promise).rejects.toThrow(abortMessage);
      // Verify the thrown error is an 'AbortError' by checking its constructor name
      await expect(promise).rejects.toSatisfy(
        (e: Error) => e.constructor.name === 'AbortError'
      );
      
      // Verify it checked the error
      expect(mockAbortChecker).toHaveBeenCalledWith(error);
      
      // Verify no error was collected
      expect(() => handler.finalizeErrorHandling()).not.toThrow();
    });
  });

  // --- Test checkAborting ---

  describe('checkAborting', () => {
    it('should rethrow if not an abort error', async () => {
      const error = new Error('test error');
      const message = 'Checking an error';
      
      // Setup: NOT an abort error
      mockAbortChecker.mockResolvedValue(null);

      const promise = async() => { throw await handler.checkAborting(error, message); }

      await expect(promise).rejects.toThrow("Checking an error\nError: test error");
      
      // Verify it checked and logged
      expect(mockAbortChecker).toHaveBeenCalledWith(error);
      
      // Verify no error was collected
      expect(() => handler.finalizeErrorHandling()).not.toThrow();
    });

    it('should throw an AbortError if it is an abort error', async () => {
      const error = new Error('critical error');
      const message = 'Checking an error';
      const abortMessage = 'STOP_EVERYTHING';

      // Setup: IS an abort error
      mockAbortChecker.mockResolvedValue(abortMessage);

      const promise = handler.checkAborting(error, message);

      // Verify it throws the abort message
      await expect(promise).rejects.toThrow(abortMessage);
      // Verify it's an AbortError
      await expect(promise).rejects.toSatisfy(
        (e: Error) => e.constructor.name === 'AbortError'
      );

      // Verify it checked and logged
      expect(mockAbortChecker).toHaveBeenCalledWith(error);
    });
  });


  // --- Test executeInterceptingAborts ---

  describe('executeInterceptingAborts', () => {
    it('should return the result of the lambda if it succeeds', async () => {
      const successValue = 'Success!';
      const lambda = vi.fn().mockResolvedValue(successValue);

      const result = await handler.executeInterceptingAborts(lambda);

      expect(result).toBe(successValue);
      expect(lambda).toHaveBeenCalledOnce();
    });

    it('should rethrow a non-abort error via logAndRethrow', async () => {
      const error = new Error('Regular error');
      const lambda = vi.fn().mockRejectedValue(error);

      const promise = handler.executeInterceptingAborts(lambda);

      // Verify it re-throws the original error
      await expect(promise).rejects.toThrow("Rethrow error that is not an 'abort message'\nError: Regular error");
    });

    it('should rethrow a non error via logAndRethrow', async () => {
      const error = 2
      const lambda = vi.fn().mockRejectedValue(error);

      const promise = handler.executeInterceptingAborts(lambda);

      // Verify it re-throws the original error
      await expect(promise).rejects.toThrow("Rethrow error that is not an 'abort message'\n2");
    });

    it('should rethrow a null via logAndRethrow', async () => {
      const error = null
      const lambda = vi.fn().mockRejectedValue(error);

      const promise = handler.executeInterceptingAborts(lambda);

      // Verify it re-throws the original error
      await expect(promise).rejects.toThrow("Rethrow error that is not an 'abort message'\nnull");
    });

    it('should catch an AbortError, log info, and return the message', async () => {
      const abortMessage = 'CAUGHT_ABORT';
      
      // Setup: Make the checker trigger an abort
      mockAbortChecker.mockResolvedValue(abortMessage);
      const internalError = new Error('internal');
      
      // Create a lambda that will trigger the abort
      const lambda = async () => {
        // This call will throw the AbortError internally
        await handler.checkAborting(internalError, 'internal check');
        return 'should not reach here';
      };

      const result = await handler.executeInterceptingAborts(lambda);

      // Verify it caught the abort and returned the message
      expect(result).toBe(abortMessage);
    });
  });
});
