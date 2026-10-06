import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  fromKeyValueArrayToObject, 
  computeScheduleSuffix, 
  KeyValue, 
  delay, 
  getRandomFutureDate, 
  intFromEnv 
} from '../../src/Utils';

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

describe('getRandomFutureDate', () => {
  const MOCK_NOW = 1700000000000; // Fixed timestamp in ms

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return date with min offset when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const minOffset = 300; // 5 minutes
    const maxOffset = 900; // 15 minutes

    const result = getRandomFutureDate(minOffset, maxOffset);
    const expectedTime = MOCK_NOW + minOffset * 1000;

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(expectedTime);
  });

  it('should return date with max offset when Math.random returns 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const minOffset = 300;
    const maxOffset = 900;

    const result = getRandomFutureDate(minOffset, maxOffset);
    const expectedTime = MOCK_NOW + maxOffset * 1000;

    expect(result.getTime()).toBe(expectedTime);
  });

  it('should return midpoint offset when Math.random returns 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const minOffset = 100;
    const maxOffset = 200;

    const result = getRandomFutureDate(minOffset, maxOffset);
    // Offset = 100 + 0.5 * (200 - 100) = 150 seconds = 150,000 ms
    const expectedTime = MOCK_NOW + 150000;

    expect(result.getTime()).toBe(expectedTime);
  });
});

describe('intFromEnv', () => {
  const TEST_ENV_KEY = 'TEST_INT_VAR';
  const originalEnvValue = process.env[TEST_ENV_KEY];

  afterEach(() => {
    if (originalEnvValue !== undefined) {
      process.env[TEST_ENV_KEY] = originalEnvValue;
    } else {
      delete process.env[TEST_ENV_KEY];
    }
  });

  it('should return parsed integer when environment variable is set', () => {
    process.env[TEST_ENV_KEY] = '42';
    expect(intFromEnv(TEST_ENV_KEY)).toBe(42);
  });

  it('should handle negative numeric strings in environment variable', () => {
    process.env[TEST_ENV_KEY] = '-15';
    expect(intFromEnv(TEST_ENV_KEY)).toBe(-15);
  });

  it('should trim strings in environment variable', () => {
    process.env[TEST_ENV_KEY] = ' -14 ';
    expect(intFromEnv(TEST_ENV_KEY)).toBe(-14);
  });

  it('should return null when environment variable is not defined', () => {
    delete process.env[TEST_ENV_KEY];
    expect(intFromEnv(TEST_ENV_KEY)).toBe( null );
  });

  it('should return null when environment variable is empty', () => {
    process.env[TEST_ENV_KEY] = "";
    expect(intFromEnv(TEST_ENV_KEY)).toBe( null );
  });

  it('should return null when environment variable is blank', () => {
    process.env[TEST_ENV_KEY] = "  ";
    expect(intFromEnv(TEST_ENV_KEY)).toBe( null );
  });

  it('should throw error when environment variable is non-numeric string', () => {
    process.env[TEST_ENV_KEY] = 'invalid_number';
    const expectedErrorMessage = "Error parsing TEST_INT_VAR value (invalid_number) to integer";
    expect(() => intFromEnv(TEST_ENV_KEY)).toThrowError( expectedErrorMessage );
  });

});
