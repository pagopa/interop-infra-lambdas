import { describe, it, expect } from 'vitest';
import { groupMaterializedViews } from '../../src/groupMaterializedViews'; 
import { ViewAndLevel } from '../../src/MaterializedViewHelper'; 


// --- Test Suite ---
describe('groupMaterializedViews', () => {

  it('should group views by their level and sort the groups in ascending order', () => {
    // ARRANGE: Input with mixed, unsorted levels
    const view1: ViewAndLevel = { mvSchemaName: 's1', mvName: 'view_a', mvLevel: 1 };
    const view2: ViewAndLevel = { mvSchemaName: 's2', mvName: 'view_b', mvLevel: 2 };
    const view3: ViewAndLevel = { mvSchemaName: 's1', mvName: 'view_c', mvLevel: 1 };
    const view4: ViewAndLevel = { mvSchemaName: 's3', mvName: 'view_d', mvLevel: 3 };
    
    const views: ViewAndLevel[] = [view2, view4, view1, view3];

    // ACT
    const result = groupMaterializedViews(views);

    // ASSERT
    // The result should be a 2D array, with the outer array sorted by level.
    expect(result).toEqual([
      [view1, view3], // Level 1
      [view2],        // Level 2
      [view4],        // Level 3
    ]);
  });

  it('should return an empty array when given an empty array', () => {
    // ARRANGE
    const views: ViewAndLevel[] = [];

    // ACT
    const result = groupMaterializedViews(views);

    // ASSERT
    expect(result).toEqual([]);
  });

  it('should place all items into a single group if they have the same level', () => {
    // ARRANGE
    const view1: ViewAndLevel = { mvSchemaName: 's1', mvName: 'view_a', mvLevel: 5 };
    const view2: ViewAndLevel = { mvSchemaName: 's2', mvName: 'view_b', mvLevel: 5 };
    const view3: ViewAndLevel = { mvSchemaName: 's1', mvName: 'view_c', mvLevel: 5 };

    const views: ViewAndLevel[] = [view1, view2, view3];

    // ACT
    const result = groupMaterializedViews(views);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([view1, view2, view3]);
  });
  
  it('should correctly handle non-sequential levels and maintain sort order', () => {
    // ARRANGE: Input with a gap in levels (e.g., 10 and 12, but no 11)
    const view1: ViewAndLevel = { mvSchemaName: 's1', mvName: 'view_a', mvLevel: 12 };
    const view2: ViewAndLevel = { mvSchemaName: 's2', mvName: 'view_b', mvLevel: 10 };

    const views: ViewAndLevel[] = [view1, view2];

    // ACT
    const result = groupMaterializedViews(views);

    // ASSERT
    expect(result).toEqual([
      [view2], // Level 10 should come first
      [view1], // Level 12 should come second
    ]);
  });
});