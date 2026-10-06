import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuickSightAlertScheduler } from '../../src/QuickSightAlertScheduler';
import { AwsQuickSightWrapper, DataSetSummaryWithTags } from '../../src/AwsQuickSightWrapper';
import * as Utils from '../../src/Utils';

describe('QuickSightAlertScheduler - Constructor', () => {
  let mockQsWrapper: AwsQuickSightWrapper;

  const mockDataSet: DataSetSummaryWithTags = {
    Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/test-ds',
    DataSetId: 'test-ds',
    tags: { RefreshType: 'FULL_REFRESH' },
  };

  beforeEach(() => {
    // Mock the QuickSight wrapper instance methods
    mockQsWrapper = {
      listScheduleSupportingDataSets: vi.fn().mockResolvedValue([mockDataSet]),
      hasTagsByPrefix: vi.fn().mockReturnValue(true),
      getTagValue: vi.fn((ds, tagKey) => (tagKey === 'RefreshType' ? 'FULL_REFRESH' : undefined)),
      createRefreshSchedule: vi.fn().mockResolvedValue(undefined),
      deleteRefreshSchedule: vi.fn().mockResolvedValue(undefined),
    } as unknown as AwsQuickSightWrapper;

    vi.spyOn(Utils, 'getRandomFutureDate').mockReturnValue(new Date());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call intFromEnv for both min and max offset keys on initialization', () => {
    const intFromEnvSpy = vi.spyOn(Utils, 'intFromEnv');

    new QuickSightAlertScheduler(mockQsWrapper);

    expect(intFromEnvSpy).toHaveBeenCalledWith('MIN_REFRESH_SCHEDULE_OFFSET_SECS');
    expect(intFromEnvSpy).toHaveBeenCalledWith('MAX_REFRESH_SCHEDULE_OFFSET_SECS');
  });

  it('should initialize schedule offsets using parsed values from intFromEnv', async () => {
    // Force intFromEnv to return custom offset numbers
    vi.spyOn(Utils, 'intFromEnv').mockImplementation((key) => {
      if (key === 'MIN_REFRESH_SCHEDULE_OFFSET_SECS') return 600;  // 10 mins
      if (key === 'MAX_REFRESH_SCHEDULE_OFFSET_SECS') return 1800; // 30 mins
      return null;
    });

    const getRandomFutureDateSpy = vi.spyOn(Utils, 'getRandomFutureDate');

    const scheduler = new QuickSightAlertScheduler(mockQsWrapper);
    await scheduler.activateScheduling();

    // Verify getRandomFutureDate received the offsets initialized in the constructor
    expect(getRandomFutureDateSpy).toHaveBeenCalledWith(600, 1800);
  });

  it('should pass fallback offset values when intFromEnv returns 0/falsy', async () => {
    // When environment variables are missing, intFromEnv returns 0
    vi.spyOn(Utils, 'intFromEnv').mockReturnValue( null );

    const getRandomFutureDateSpy = vi.spyOn(Utils, 'getRandomFutureDate');

    const scheduler = new QuickSightAlertScheduler(mockQsWrapper);
    await scheduler.activateScheduling();

    expect(getRandomFutureDateSpy).toHaveBeenCalledWith(300, 900);
  });
});
