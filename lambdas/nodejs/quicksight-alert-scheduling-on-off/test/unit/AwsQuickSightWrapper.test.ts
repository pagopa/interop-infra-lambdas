import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { AwsQuickSightWrapper, DataSetSummaryWithTags } from '../../src/AwsQuickSightWrapper';
import { AwsStsWrapper } from '../../src/AwsStsWrapper';
import {
  QuickSightClient,
  ListDataSetsCommand,
  ListTagsForResourceCommand,
  CreateRefreshScheduleCommand,
  DeleteRefreshScheduleCommand,
} from '@aws-sdk/client-quicksight';

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
let warnSpy: MockInstance | undefined; // - I need to test warn

// 1. MOCK THE AWS SDK CLIENT
// We mock the entire module to control its behavior and prevent real AWS calls.
const mockQuicksightSend = vi.fn();
vi.mock('@aws-sdk/client-quicksight', async (importOriginal) => {
  // We import the original module to get access to the real Command classes.
  // This allows us to use `instanceof` to check which command is being sent.
  const original = await importOriginal<typeof import('@aws-sdk/client-quicksight')>();
  return {
    ...original, // Keep original enums, etc.
    QuickSightClient: vi.fn().mockImplementation(() => ({
      send: mockQuicksightSend,
    })),
    // Expose the real command classes for `instanceof` checks
    ListDataSetsCommand: original.ListDataSetsCommand,
    ListTagsForResourceCommand: original.ListTagsForResourceCommand,
    CreateRefreshScheduleCommand: original.CreateRefreshScheduleCommand,
    DeleteRefreshScheduleCommand: original.DeleteRefreshScheduleCommand,
  };
});


// 2. DEFINE THE TEST SUITE
describe('AwsQuickSightWrapper', () => {
  const MOCK_AWS_ACCOUNT_ID = '123456789012';

  // Create a mock object for the AwsStsWrapper dependency.
  // We can control its methods for each test.
  let mockStsWrapper: AwsStsWrapper;

  // Define reusable mock data for our tests.
  const spiceDataSet: DataSetSummaryWithTags = {
    Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/spice-id',
    DataSetId: 'spice-id',
    Name: 'SPICE Dataset',
    ImportMode: 'SPICE',
    tags: {}
  };
  const directQueryDataSet: DataSetSummaryWithTags = {
    Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dq-id',
    DataSetId: 'dq-id',
    Name: 'Direct Query Dataset',
    ImportMode: 'DIRECT_QUERY',
    tags: {}
  };

  // This runs before each test, ensuring a clean state.
  beforeEach(() => {
    // Reset all mock functions' history.
    vi.clearAllMocks();

    // Re-create the mock dependency for each test.
    mockStsWrapper = {
      getAwsAccountId: vi.fn(),
    } as unknown as AwsStsWrapper;

    // Set a default return value for the mock dependency.
    vi.mocked(mockStsWrapper.getAwsAccountId).mockResolvedValue(MOCK_AWS_ACCOUNT_ID);

    // spy for warn
    warnSpy = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    if( warnSpy ) {
      warnSpy.mockRestore();
      warnSpy = undefined;
    }
    
  });

  // --- TESTS FOR listScheduleSupportingDataSets ---
  describe('listScheduleSupportingDataSets', () => {
    it('should list, filter for SPICE datasets, and enrich them with tags', async () => {
      // ARRANGE: Configure the mock `send` to respond based on the command type.
      mockQuicksightSend.mockImplementation(async (command) => {
        if (command instanceof ListDataSetsCommand) {
          return { DataSetSummaries: [spiceDataSet, directQueryDataSet] };
        }
        if (command instanceof ListTagsForResourceCommand) {
          return { Tags: [
            { Key: 'Managed', Value: 'True' }, 
            { Key: 'UndefValue' },
            {} // - Ignored
          ]};
        }
      });

      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT
      const result = await wrapper.listScheduleSupportingDataSets();

      // ASSERT
      expect(result).toHaveLength(1); // Only the SPICE dataset should be returned.
      expect(result[0].DataSetId).toBe(spiceDataSet.DataSetId);
      expect(result[0].tags).toEqual({ Managed: 'True', UndefValue: undefined }); // It should have tags.
      expect(mockQuicksightSend).toHaveBeenCalledTimes(2); // 1 to list, 1 to get tags.
    });

    it('should handle pagination correctly when listing datasets', async () => {
      // ARRANGE: Simulate a paginated API response.
      mockQuicksightSend
        .mockResolvedValueOnce({ // First call to ListDataSetsCommand
          DataSetSummaries: [directQueryDataSet],
          NextToken: 'page2-token',
        })
        .mockResolvedValueOnce({ // Second call to ListDataSetsCommand
          DataSetSummaries: [spiceDataSet, spiceDataSet],
          NextToken: 'page3-token',
        })
        .mockResolvedValueOnce({ // Third call to ListDataSetsCommand
          DataSetSummaries: null,
          NextToken: undefined,
        })
        .mockResolvedValueOnce({ // Call to ListTagsForResourceCommand
          Tags: [{ Key: 'Project', Value: 'Alpha' }],
        })
        .mockResolvedValueOnce({ // Call to ListTagsForResourceCommand
          Tags: null,
        });

      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT
      const result = await wrapper.listScheduleSupportingDataSets();

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].DataSetId).toBe(spiceDataSet.DataSetId);
      expect(result[0].tags).toStrictEqual({ Project: 'Alpha' });
      expect(result[1].DataSetId).toBe(spiceDataSet.DataSetId);
      expect(result[1].tags).toStrictEqual({ });
      expect(mockQuicksightSend).toHaveBeenCalledTimes(5); // 3 to list, 2 for tags.
    });

    it('should rethrow errors during listing', async () => {
      // ARRANGE: Simulate an error
      mockQuicksightSend.mockRejectedValueOnce(new Error("Send fail"));
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT
      await expect( async () => await wrapper.listScheduleSupportingDataSets()).rejects.toThrow("Send fail");
    });

    it('should rethrow errors during tag reading', async () => {
      // ARRANGE: Simulate an error
      mockQuicksightSend
        .mockResolvedValueOnce({ // First call to ListDataSetsCommand
          DataSetSummaries: [spiceDataSet],
          NextToken: undefined,
        })
        .mockRejectedValue( // Second call to ListTagsForResourceCommand
          new Error("Error getting tags")
        )
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT
      await expect( async () => await wrapper.listScheduleSupportingDataSets()).rejects.toThrow("Error getting tags");
    });
  });

  // --- TESTS FOR getTagValue ---
  describe('getTagValue', () => {
    it('should get value if present', async () => {
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);
      const dsWithTags = { ... spiceDataSet };
      dsWithTags.tags = { "ATag": "Value" }
      
      // ACT 
      const v = wrapper.getTagValue( dsWithTags, "ATag");

      // ASSERT
      expect( v ).toBe( dsWithTags.tags.ATag )
    });
  });


  // --- TESTS FOR createRefreshSchedule ---
  describe('createRefreshSchedule', () => {
    it('should throw an error for an unsupported refresh type', async () => {
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT
      await expect(wrapper.createRefreshSchedule(spiceDataSet, 'INVALID_TYPE')).rejects.toThrow(
        'refresh type not supported: INVALID_TYPE'
      );
      // Ensure no AWS call was made for an invalid type.
      expect(mockQuicksightSend).not.toHaveBeenCalled();
    });

    it('should not throw an error if the schedule already exists (ResourceExistsException)', async () => {
      // ARRANGE: Mock the AWS SDK to throw the specific "already exists" error.
      mockQuicksightSend.mockRejectedValue({ name: 'ResourceExistsException' });
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT 
      await wrapper.createRefreshSchedule(spiceDataSet, 'FULL_REFRESH')
      
      // ASSERT: The method should catch this specific error and resolve successfully.
      expect( mockQuicksightSend ).toHaveBeenCalledOnce()

      const sentCommand = mockQuicksightSend.mock.calls[0][0] as CreateRefreshScheduleCommand;
      expect( sentCommand.input.Schedule?.RefreshType ).toBe('FULL_REFRESH')
      expect( sentCommand.input.Schedule?.ScheduleFrequency?.Interval ).toBe('HOURLY')

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should create schedule if no error', async () => {
      // ARRANGE: Mock the AWS SDK to throw the specific "already exists" error.
      mockQuicksightSend.mockResolvedValueOnce({});
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT 
      await wrapper.createRefreshSchedule(spiceDataSet, 'INCREMENTAL_REFRESH')
      
      // ASSERT: The method should resolve successfully.
      expect( mockQuicksightSend ).toHaveBeenCalledOnce()

      const sentCommand = mockQuicksightSend.mock.calls[0][0] as CreateRefreshScheduleCommand;
      expect( sentCommand.input.Schedule?.RefreshType ).toBe('INCREMENTAL_REFRESH')
      expect( sentCommand.input.Schedule?.ScheduleFrequency?.Interval ).toBe('MINUTE15')
    });

    it('should rethrow errors', async () => {
      // ARRANGE: Simulate an error
      mockQuicksightSend.mockRejectedValueOnce(new Error("Send fail"));
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT
      await expect( async () => await wrapper.createRefreshSchedule(spiceDataSet, 'INCREMENTAL_REFRESH')).rejects.toThrow("Send fail");
    });
  });


  // --- TESTS FOR deleteRefreshSchedule ---
  describe('deleteRefreshSchedule', () => {
    it('should call the send command with the correct parameters', async () => {
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);
      mockQuicksightSend.mockResolvedValue({})
      
      // ACT
      await wrapper.deleteRefreshSchedule(spiceDataSet);
      
      // ASSERT
      expect(mockQuicksightSend).toHaveBeenCalledOnce();
      const sentCommand = mockQuicksightSend.mock.calls[0][0] as DeleteRefreshScheduleCommand;
      console.log("SENT_COMMAND", sentCommand)
      expect(sentCommand.input.AwsAccountId).toBe(MOCK_AWS_ACCOUNT_ID);
      expect(sentCommand.input.DataSetId).toBe(spiceDataSet.DataSetId);
      expect(sentCommand.input.ScheduleId).toBe(`${spiceDataSet.DataSetId}-schedule`);
    });

    it('should not throw an error if the schedule is not found (ResourceNotFoundException)', async () => {
      // ARRANGE: Mock the AWS SDK to throw the specific "not found" error.
      mockQuicksightSend.mockRejectedValue({ name: 'ResourceNotFoundException' });
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT: The method should catch this error and resolve successfully.
      await expect(wrapper.deleteRefreshSchedule(spiceDataSet)).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should rethrow errors', async () => {
      // ARRANGE: Simulate an error
      mockQuicksightSend.mockRejectedValueOnce(new Error("Send fail"));
      const wrapper = new AwsQuickSightWrapper(mockStsWrapper);

      // ACT & ASSERT
      await expect( async () => await wrapper.deleteRefreshSchedule(spiceDataSet)).rejects.toThrow("Send fail");
    });
  });

});
