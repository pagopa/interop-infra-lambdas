import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fromKeyValueArrayToObject, computeScheduleSuffix, KeyValue, delay } from '../../src/Utils';

describe('fromKeyValueArrayToObject', () => {
  it('should convert a KeyValue array into a plain key-value object', () => {
    const input: KeyValue[] = [
      { Key: 'env', Value: 'production' },
      { Key: 'region', Value: 'us-east-1' },
    ];
    const expected = {
      env: 'production',
      region: 'us-east-1',
    };

    expect(fromKeyValueArrayToObject(input)).toEqual(expected);
  });

  it('should preserve keys whose Value is undefined', () => {
    const input: KeyValue[] = [
      { Key: 'optionalKey', Value: undefined },
    ];
    const expected = {
      optionalKey: undefined,
    };

    expect(fromKeyValueArrayToObject(input)).toEqual(expected);
  });

  it('should ignore elements with undefined or empty Key properties', () => {
    const input: KeyValue[] = [
      { Key: undefined, Value: 'ignoredValue' },
      { Key: '', Value: 'alsoIgnored' },
      { Key: 'validKey', Value: 'validValue' },
    ];
    const expected = {
      validKey: 'validValue',
    };

    expect(fromKeyValueArrayToObject(input)).toEqual(expected);
  });

  it('should overwrite values when duplicate keys are present', () => {
    const input: KeyValue[] = [
      { Key: 'duplicate', Value: 'first' },
      { Key: 'duplicate', Value: 'second' },
    ];
    const expected = {
      duplicate: 'second',
    };

    expect(fromKeyValueArrayToObject(input)).toEqual(expected);
  });

  it('should return an empty object when passed an empty array', () => {
    expect(fromKeyValueArrayToObject([])).toEqual({});
  });
});

describe('computeScheduleSuffix', () => {
  it('should return an empty string for index 0', () => {
    expect(computeScheduleSuffix(0)).toBe('');
  });

  it.each([
    { index: 1, expected: '_2' },
    { index: 2, expected: '_3' },
    { index: 3, expected: '_4' },
    { index: 4, expected: '_5' },
  ])('should return "$expected" for index $index', ({ index, expected }) => {
    expect(computeScheduleSuffix(index)).toBe(expected);
  });

  it.each([-1, 5, 10])('should throw an error for unsupported index %i', (index) => {
    expect(() => computeScheduleSuffix(index)).toThrowError(
      `Schedule index "${index}" not supported! Expected one of 0 1 2 3 4`
    );
  });
});

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve only after the specified time has elapsed', async () => {
    let resolved = false;

    // Start the delay promise
    const promise = delay(1000).then(() => {
      resolved = true;
    });

    // Should not be resolved immediately
    expect(resolved).toBe(false);

    // Advance time by 999ms (1ms short)
    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    // Advance the remaining 1ms
    await vi.advanceTimersByTimeAsync(1);
    await promise;

    expect(resolved).toBe(true);
  });

  it('should resolve correctly for a 0 millisecond delay', async () => {
    let resolved = false;

    const promise = delay(0).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect(resolved).toBe(true);
  });
});