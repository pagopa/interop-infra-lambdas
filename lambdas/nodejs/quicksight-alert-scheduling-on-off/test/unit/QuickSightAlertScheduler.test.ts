import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickSightAlertScheduler } from '../../src/QuickSightAlertScheduler';
import { AwsQuickSightWrapper } from '../../src/AwsQuickSightWrapper';

// We spy on console.error to ensure it's called without polluting test logs.
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// 1. DEFINE THE TEST SUITE
describe('QuickSightAlertScheduler', () => {

  // Create a mock object that mimics the structure and methods of AwsQuickSightWrapper.
  // We'll use this as our dependency in the tests.
  let mockQuickSightWrapper: AwsQuickSightWrapper;

  // Define reusable mock data. This setup is key to testing the filtering logic.
  const dataSetWithTag = {
    Arn: 'arn:aws:quicksight:us-east-1:123:dataset/with-tag',
    DataSetId: 'with-tag-id',
    // It has the specific 'RefreshType' tag the class looks for.
    tags: { 'RefreshType': 'FULL_REFRESH' }, 
  };

  const dataSetWithoutTag = {
    Arn: 'arn:aws:quicksight:us-east-1:123:dataset/without-tag',
    DataSetId: 'without-tag-id',
    // It has a different tag, so it should be ignored by the scheduler.
    tags: { 'OtherTag': 'SomeValue' },
  };


  // This hook runs before each 'it' block, ensuring a clean slate for every test.
  beforeEach(() => {
    // We create a fresh mock object for each test to prevent interference.
    mockQuickSightWrapper = {
      listScheduleSupportingDataSets: vi.fn(),
      getTagValue: vi.fn(),
      createRefreshSchedule: vi.fn(),
      deleteRefreshSchedule: vi.fn(),
    } as unknown as AwsQuickSightWrapper;
  });

  // --- TESTS FOR activateScheduling ---
  describe('activateScheduling', () => {

    it('should create schedules ONLY for datasets that have the "RefreshType" tag', async () => {
      // ARRANGE
      // 1. Simulate the wrapper finding two datasets (one with the tag, one without).
      vi.mocked(mockQuickSightWrapper.listScheduleSupportingDataSets).mockResolvedValue([
        dataSetWithTag,
        dataSetWithoutTag,
      ]);
      
      // 2. Simulate the getTagValue behavior to drive the filtering logic.
      vi.mocked(mockQuickSightWrapper.getTagValue).mockImplementation((dataset, tagName) => {
        // Return the tag value if it's the one we're looking for.
        if (dataset.DataSetId === dataSetWithTag.DataSetId && tagName === 'RefreshType') {
          return 'FULL_REFRESH';
        }
        // Return undefined for the dataset without the tag.
        return undefined;
      });

      // Create the class instance, injecting our mock dependency.
      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT
      await scheduler.activateScheduling();
      
      // ASSERT
      // Check that the schedule creation was attempted ONLY ONCE.
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledOnce();
      
      // Check that it was called with the correct dataset and the value from its tag.
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 'FULL_REFRESH');
      
      // Ensure the delete method was never touched.
      expect(mockQuickSightWrapper.deleteRefreshSchedule).not.toHaveBeenCalled();
    });

    it('should do nothing if no datasets have the "RefreshType" tag', async () => {
      // ARRANGE
      // Simulate the wrapper finding only a dataset that should be ignored.
      vi.mocked(mockQuickSightWrapper.listScheduleSupportingDataSets).mockResolvedValue([dataSetWithoutTag]);
      vi.mocked(mockQuickSightWrapper.getTagValue).mockReturnValue(undefined);

      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT
      await scheduler.activateScheduling();
      
      // ASSERT
      // Verify that no scheduling actions were taken.
      expect(mockQuickSightWrapper.createRefreshSchedule).not.toHaveBeenCalled();
      expect(mockQuickSightWrapper.deleteRefreshSchedule).not.toHaveBeenCalled();
    });
  });

  // --- TESTS FOR deactivateScheduling ---
  describe('deactivateScheduling', () => {

    it('should delete schedules ONLY for datasets with the "RefreshType" tag', async () => {
      // ARRANGE
      vi.mocked(mockQuickSightWrapper.listScheduleSupportingDataSets).mockResolvedValue([
        dataSetWithTag,
        dataSetWithoutTag,
      ]);
      
      vi.mocked(mockQuickSightWrapper.getTagValue).mockImplementation((dataset, tagName) => {
        if (dataset.DataSetId === dataSetWithTag.DataSetId && tagName === 'RefreshType') {
          return 'FULL_REFRESH'; // The value doesn't matter here, just its existence.
        }
        return undefined;
      });

      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT
      await scheduler.deactivateScheduling();
      
      // ASSERT
      // Check that the schedule deletion was attempted ONLY ONCE.
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledOnce();
      
      // Check that it was called with the correct dataset.
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag);
      
      // Ensure the create method was never touched.
      expect(mockQuickSightWrapper.createRefreshSchedule).not.toHaveBeenCalled();
    });
  });

});
