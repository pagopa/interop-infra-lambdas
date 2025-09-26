import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsStsWrapper } from '../../src/AwsStsWrapper'; // Adjust this import path if needed
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// 1. MOCK THE AWS SDK MODULE
// =============================
// We mock the entire module to prevent real AWS calls and to control the behavior
// of the STSClient for our tests.
const mockStsSend = vi.fn();
vi.mock('@aws-sdk/client-sts', () => {
  // Mock the STSClient class. Its constructor returns an object
  // with a `send` method, which is our mock function.
  const MockSTSClient = vi.fn().mockImplementation(() => ({
    send: mockStsSend,
  }));

  // Mock the command class as well.
  const MockGetCallerIdentityCommand = vi.fn();

  return {
    STSClient: MockSTSClient,
    GetCallerIdentityCommand: MockGetCallerIdentityCommand,
  };
});

// Get typed versions of the mocked classes for better autocompletion and type checking.
const MockedSTSClient = vi.mocked(STSClient);

describe('AwsStsWrapper', () => {

  // 2. RESET MOCKS BEFORE EACH TEST
  // =================================
  // This ensures that our tests are isolated and one test's mock behavior
  // doesn't leak into another.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 3. DEFINE THE TEST CASES
  // ========================

  it('should fetch and return the AWS Account ID on the first call', async () => {
    const mockAccountId = '123456789012';
    // Configure our mock `send` function to return a successful response.
    mockStsSend.mockResolvedValue({ Account: mockAccountId });

    const wrapper = new AwsStsWrapper();
    const accountId = await wrapper.getAwsAccountId();

    // Assert: The method returns the correct account ID.
    expect(accountId).toBe(mockAccountId);

    // Assert: The STS client was instantiated and its `send` method was called once.
    expect(MockedSTSClient).toHaveBeenCalledTimes(1);
    expect(mockStsSend).toHaveBeenCalledTimes(1);
  });

  it('should return the cached AWS Account ID on subsequent calls without calling the server', async () => {
    const mockAccountId = '987654321098';
    mockStsSend.mockResolvedValue({ Account: mockAccountId });

    const wrapper = new AwsStsWrapper();

    // First call - this should trigger the remote call.
    const firstResult = await wrapper.getAwsAccountId();
    expect(firstResult).toBe(mockAccountId);
    expect(mockStsSend).toHaveBeenCalledTimes(1); // Verify the call was made.

    // Second call - this should hit the cache.
    const secondResult = await wrapper.getAwsAccountId();
    expect(secondResult).toBe(mockAccountId);

    // Assert: The `send` method was NOT called again. The total call count is still 1.
    expect(mockStsSend).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if the STS response does not contain an Account ID', async () => {
    // Mock a successful response but with a missing 'Account' property.
    mockStsSend.mockResolvedValue({ UserId: 'some-user-id' }); // No 'Account' field

    const wrapper = new AwsStsWrapper();

    // Assert: The promise is rejected with the specific error message from your class.
    await expect(wrapper.getAwsAccountId()).rejects.toThrow(
      'Account ID not found in STS response.'
    );
  });

  it('should re-throw an error if the STS client fails to send the command', async () => {
    const sdkErrorMessage = 'AWS SDK Error: Access Denied';
    // Mock the `send` method to reject, simulating a network or permission error.
    mockStsSend.mockRejectedValue(new Error(sdkErrorMessage));

    const wrapper = new AwsStsWrapper();

    // Assert: The promise is rejected with the same error that the SDK threw.
    await expect(wrapper.getAwsAccountId()).rejects.toThrow(sdkErrorMessage);
  });
});