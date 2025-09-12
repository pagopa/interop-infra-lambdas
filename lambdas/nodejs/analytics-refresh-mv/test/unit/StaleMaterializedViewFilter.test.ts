import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaleMaterializedViewFilter } from '../../src/StaleMaterializedViewFilter';
import { ViewAndLevel } from '../../src/ViewAndLevel';

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});


describe('StaleMaterializedViewFilter', () => {

  // --- 1. CONSTRUCTOR TESTS (Corrected) ---
  // These tests verify the constructor's configuration by observing the
  // public behavior of the `filterAll` method. This avoids trying to
  // access private fields directly.
  // ======================================================================================
  describe('Constructor', () => {
    
    // Use fake timers to control the "current" time for these tests
    const NOW_DATE = new Date('2025-09-12T10:00:00.000Z');
    const NOW_EPOCH = Math.ceil(NOW_DATE.getTime() / 1000);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW_DATE);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should apply the INCREMENTAL_MV_MIN_INTERVAL correctly', async () => {
      const mockEnv = { INCREMENTAL_MV_MIN_INTERVAL: '300' }; // 5 minutes
      const filter = new StaleMaterializedViewFilter(mockEnv);
      
      const staleMv: ViewAndLevel = {
        mvName: 'stale', mvSchemaName: 's', mvLevel: 1, incrementalRefreshNotSupported: false,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 301 // Refreshed just over 5 mins ago -> should be kept
      };
      const recentMv: ViewAndLevel = {
        mvName: 'recent', mvSchemaName: 's', mvLevel: 1, incrementalRefreshNotSupported: false,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 299 // Refreshed just under 5 mins ago -> should be removed
      };
      
      const result: ViewAndLevel[] = await filter.filterAll([staleMv, recentMv]);
      expect(result).toHaveLength(1);
      expect(result[0].mvName).toBe('stale');
    });

    it('should apply the NOT_INCREMENTAL_MV_MIN_INTERVAL correctly', async () => {
      const mockEnv = { NOT_INCREMENTAL_MV_MIN_INTERVAL: '3600' }; // 1 hour
      const filter = new StaleMaterializedViewFilter(mockEnv);
      
      const staleMv: ViewAndLevel = {
        mvName: 'stale', mvSchemaName: 's', mvLevel: 1, incrementalRefreshNotSupported: true,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 3601 // Refreshed just over 1 hour ago -> should be kept
      };
      const recentMv: ViewAndLevel = {
        mvName: 'recent', mvSchemaName: 's', mvLevel: 1, incrementalRefreshNotSupported: true,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 3599 // Refreshed just under 1 hour ago -> should be removed
      };

      const result: ViewAndLevel[] = await filter.filterAll([staleMv, recentMv]);
      expect(result).toHaveLength(1);
      expect(result[0].mvName).toBe('stale');
    });

    it('should default to a 0-second delay if environment variables are not set', async () => {
      const filter = new StaleMaterializedViewFilter({}); // Empty env
      
      // With a 0 delay, any view refreshed in the past should be kept
      const mv = {
        mvName: 'any-mv', mvSchemaName: 's', mvLevel: 1, incrementalRefreshNotSupported: false,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 1 // Refreshed 1 second ago
      };
      
      const result = await filter.filterAll([mv]);
      expect(result).toHaveLength(1);
    });

    it('should throw an error if an environment variable is not a valid number', () => {
      const mockEnv = { INCREMENTAL_MV_MIN_INTERVAL: 'not-a-number' };
      
      expect(() => new StaleMaterializedViewFilter(mockEnv))
        .toThrow('Error parsing INCREMENTAL_MV_MIN_INTERVAL environment variable');
    });
  });


  // --- 2. FILTERING LOGIC TESTS ---
  // These tests remain the same as they were already testing the public API.
  // =======================================================================
  describe('filterAll (Comprehensive)', () => {
    
    const NOW_DATE = new Date('2025-09-12T09:00:00.000Z');
    const NOW_EPOCH = Math.ceil(NOW_DATE.getTime() / 1000);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW_DATE);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const mockEnv: NodeJS.ProcessEnv = {
        INCREMENTAL_MV_MIN_INTERVAL: '600',      // 10 minutes
        NOT_INCREMENTAL_MV_MIN_INTERVAL: '7200'  // 2 hours
    };

    const staleIncrementalMv: ViewAndLevel = {
      mvName: 'stale_incremental', mvSchemaName: 'test', mvLevel: 1,
      incrementalRefreshNotSupported: false,
      lastRefreshStartTimeEpoch: 0,
      lastRefreshEndTimeEpoch: NOW_EPOCH - 900 // 15 mins ago
    };

    const recentIncrementalMv: ViewAndLevel = {
      mvName: 'recent_incremental', mvSchemaName: 'test', mvLevel: 1,
      incrementalRefreshNotSupported: false,
      lastRefreshStartTimeEpoch: 0,
      lastRefreshEndTimeEpoch: NOW_EPOCH - 300 // 5 mins ago
    };
    
    const staleNonIncrementalMv: ViewAndLevel = {
      mvName: 'stale_non_incremental', mvSchemaName: 'test', mvLevel: 2,
      incrementalRefreshNotSupported: true,
      lastRefreshStartTimeEpoch: 0,
      lastRefreshEndTimeEpoch: NOW_EPOCH - 10800 // 3 hours ago
    };

    const recentNonIncrementalMv: ViewAndLevel = {
      mvName: 'recent_non_incremental', mvSchemaName: 'test', mvLevel: 2,
      incrementalRefreshNotSupported: true,
      lastRefreshStartTimeEpoch: 0,
      lastRefreshEndTimeEpoch: NOW_EPOCH - 3600 // 1 hour ago
    };

    it('should keep views that are older than their respective minimum delay', async () => {
      const filter = new StaleMaterializedViewFilter(mockEnv);
      const allMvs = [staleIncrementalMv, staleNonIncrementalMv];
      
      const result = await filter.filterAll(allMvs);
      
      expect(result).toEqual([staleIncrementalMv, staleNonIncrementalMv]);
    });

    it('should remove views that are more recent than their respective minimum delay', async () => {
      const filter = new StaleMaterializedViewFilter(mockEnv);
      const allMvs = [recentIncrementalMv, recentNonIncrementalMv];
      
      let totalRemoved = -1;
      let removed: ViewAndLevel[] = [];
      const logger = (mv, index ) => {
        if( mv ) {
            removed.push( mv );
        }
        else {
            totalRemoved = index;
        }
      }

      const result = await filter.filterAll(allMvs, logger );

      expect(result).toEqual([]);
      expect( totalRemoved ).toBe(2);
      expect( removed ).toStrictEqual( allMvs );
    });

    it('should correctly filter a mixed list of stale and recent views', async () => {
      const filter = new StaleMaterializedViewFilter(mockEnv);
      const allMvs = [
        staleIncrementalMv,     // Keep
        recentIncrementalMv,    // Remove
        staleNonIncrementalMv,  // Keep
        recentNonIncrementalMv, // Remove
      ];
      
      const result = await filter.filterAll(allMvs);
      
      expect(result).toHaveLength(2);
      expect(result).toEqual([staleIncrementalMv, staleNonIncrementalMv]);
    });
    
    it('should remove a view refreshed exactly on the delay boundary', async () => {
      const filter = new StaleMaterializedViewFilter(mockEnv);
      
      // Refreshed exactly 10 minutes ago. The condition `last < now - delay`
      // becomes `(now - 600) < (now - 600)`, which is false. So it is removed.
      const boundaryMv: ViewAndLevel = {
        mvName: 'boundary_incremental', mvSchemaName: 'test', mvLevel: 1,
        incrementalRefreshNotSupported: false,
        lastRefreshStartTimeEpoch: 0,
        lastRefreshEndTimeEpoch: NOW_EPOCH - 600
      };

      const result = await filter.filterAll([boundaryMv]);
      expect(result).toHaveLength(0);
    });

    it('should return an empty array if the input list is empty', async () => {
      const filter = new StaleMaterializedViewFilter(mockEnv);
      const result = await filter.filterAll([]);
      expect(result).toEqual([]);
    });

  });
});