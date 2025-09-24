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

  // --- TESTS FOR spurious missing tag ---
  describe('deactivateScheduling', () => {

    it('should throw error if "RefreshType" tag disappear', async () => {
      // ARRANGE
      vi.mocked(mockQuickSightWrapper.listScheduleSupportingDataSets).mockResolvedValue([
        dataSetWithTag
      ]);

      let numTagValueCalls = 0;
      vi.mocked(mockQuickSightWrapper.getTagValue).mockImplementation((dataset, tagName) => {
        if (dataset.DataSetId === dataSetWithTag.DataSetId && tagName === 'RefreshType' && numTagValueCalls == 0) {
          numTagValueCalls += 1;
          return 'FULL_REFRESH'; // The value doesn't matter here, just its existence.
        }
        return undefined;
      });

      const scheduler = new QuickSightAlertScheduler(mockQuickSightWrapper);
      
      // ACT & ASSERT
      await expect(() => scheduler.activateScheduling()).rejects.toThrow("Can't schedule DataSet arn:aws:quicksight:us-east-1:123:dataset/with-tag do not has tag RefreshType");
    });
  });
});
