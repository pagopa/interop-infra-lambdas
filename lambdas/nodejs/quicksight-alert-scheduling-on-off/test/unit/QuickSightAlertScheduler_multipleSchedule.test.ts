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
      hasTagsByPrefix: vi.fn(),
      createRefreshSchedule: vi.fn(),
      deleteRefreshSchedule: vi.fn(),
    } as unknown as AwsQuickSightWrapper;
  });

  // --- TESTS FOR activateScheduling ---
  describe('activateScheduling', () => {

    it('should create maximum 5 scheduler', async () => {
      // ARRANGE
      // 1. Simulate the wrapper finding two datasets (one with the tag, one without).
      vi.mocked(mockQuickSightWrapper.listScheduleSupportingDataSets).mockResolvedValue([
        dataSetWithTag,
        dataSetWithoutTag,
      ]);
      
      // 2.a. Simulate the getTagValue behavior to drive the filtering logic.
      vi.mocked(mockQuickSightWrapper.getTagValue).mockImplementation((dataset, tagName) => {
        // Return the tag value if it's the one we're looking for.
        if (dataset.DataSetId === dataSetWithTag.DataSetId) {
          if ( tagName === 'RefreshType') {
            return 'FULL_REFRESH';
          }
          else if ( tagName === 'RefreshType_2') {
            return 'INCREMENTAL_REFRESH';
          }
          else if ( tagName === 'RefreshType_3') {
            return 'INCREMENTAL_REFRESH';
          }
          else if ( tagName === 'RefreshType_4') {
            return 'INCREMENTAL_REFRESH';
          }
          else if ( tagName === 'RefreshType_5') {
            return 'INCREMENTAL_REFRESH';
          }
          else if ( tagName === 'RefreshType_6') {
            return 'INCREMENTAL_REFRESH';
          }
          
          else if ( tagName === 'RefreshInterval') {
            return 'DAILY';
          }
          else if ( tagName === 'RefreshInterval_2') {
            return 'MINUTE15';
          }
          else if ( tagName === 'RefreshInterval_3') {
            return 'MINUTE30';
          }
          else if ( tagName === 'RefreshInterval_4') {
            return 'HOURLY';
          }
          else if ( tagName === 'RefreshInterval_5') {
            return 'WEEKLY';
          }
          else if ( tagName === 'RefreshInterval_6') {
            return 'WEEKLY';
          }

          else {
            return undefined;
          }
        }
        // Return undefined for the dataset without the tag.
        return undefined;
      });

      // 2.b. Simulate the hasTagsByPrefix behavior to drive the filtering logic.
      vi.mocked(mockQuickSightWrapper.hasTagsByPrefix).mockImplementation((dataset, tagName) => {
        // Return the tag value if it's the one we're looking for.
        const result = (
          dataset.DataSetId === dataSetWithTag.DataSetId 
          && tagName.startsWith( 'RefreshType' )
        );
        return result;
      });

      // Create the class instance, injecting our mock dependency.
      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT
      await scheduler.activateScheduling();
      
      // ASSERT
      // Check that the schedule creation was attempted ONLY 5 times.
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledTimes( 5 );
      
      // Check that it was called with the correct dataset and the value from its tag.
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 
        { refreshInterval: "DAILY", refreshType: "FULL_REFRESH", index: 0 }
      );
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 
        { refreshInterval: "MIN15", refreshType: "INCREMENTAL_REFRESH", index: 1 }
      );
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 
        { refreshInterval: "MIN30", refreshType: "INCREMENTAL_REFRESH", index: 2 }
      );
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 
        { refreshInterval: "HOURLY", refreshType: "INCREMENTAL_REFRESH", index: 3 }
      );
      expect(mockQuickSightWrapper.createRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 
        { refreshInterval: "WEEKLY", refreshType: "INCREMENTAL_REFRESH", index: 4 }
      );
      
      // Ensure the delete method was never touched.
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
      vi.mocked(mockQuickSightWrapper.hasTagsByPrefix).mockImplementation((dataset, tagName) => {
        // Return the tag value if it's the one we're looking for.
        const result = (
          dataset.DataSetId === dataSetWithTag.DataSetId 
          && tagName === 'RefreshType'
        );
        return result;
      });

      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT
      await scheduler.deactivateScheduling();
      
      // ASSERT
      // Check that the schedule deletion was attempted 5 times for each dataset (1 x 5 = 5).
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledTimes( 5 );
      
      // Check that it was called with the correct dataset.
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 0);
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 1);
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 2);
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 3);
      expect(mockQuickSightWrapper.deleteRefreshSchedule).toHaveBeenCalledWith(dataSetWithTag, 4);
      
      // Ensure the create method was never touched.
      expect(mockQuickSightWrapper.createRefreshSchedule).not.toHaveBeenCalled();
    });
  });

});
