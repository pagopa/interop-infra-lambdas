import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  assertNotEmptyAndTrim,
  assertAlphanumericNotEmptyAndTrim,
  intToStringWithZeroPadding, 
  parseSchemaList
} from '../../src/utils'; // Assuming your functions are in 'utils.ts'

// We spy on console.error to ensure it's called without polluting test logs.
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});


// --------------- Test for utility function assertNotEmpty -----------------------
describe('assertNotEmpty', () => {
  // Reset the spy's call history before each test in this block
  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('should return the value if it is a valid, non-empty string', () => {
    const value = 'hello world';
    expect(assertNotEmptyAndTrim(value, 'testVar')).toBe(value);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should return the trimmed value if it contains spaces but is not empty', () => {
    const value = '  not empty  ';
    expect(assertNotEmptyAndTrim(value, 'testVar')).toBe(value.trim());
  });

  it('should throw an error for an undefined value', () => {
    const varName = 'undefinedVar';
    const expectedError = `${varName} can't be empty`;
    
    expect(() => assertNotEmptyAndTrim(undefined, varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });

  it('should throw an error for an empty string ""', () => {
    const varName = 'emptyString';
    const expectedError = `${varName} can't be empty`;

    expect(() => assertNotEmptyAndTrim('', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });

  it('should throw an error for a string containing only whitespace', () => {
    const varName = 'whitespaceVar';
    const expectedError = `${varName} can't be empty`;

    expect(() => assertNotEmptyAndTrim('   \t\n ', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });
});


// --------------- Test for utility function assertAlphanumericNotEmpty ------------------
describe('assertAlphanumericNotEmpty', () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('should return the value for a valid alphanumeric string with underscores', () => {
    const value = 'Valid_Identifier_123';
    expect(assertAlphanumericNotEmptyAndTrim(value, 'testVar')).toBe(value);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should return the value for a valid alphanumeric with trailing spaces', () => {
    const value = ' not_trimmed_value   ';
    expect(assertAlphanumericNotEmptyAndTrim(value, 'testVar')).toBe(value.trim());
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should throw a "not alphanumeric" error for a string with hyphens', () => {
    const varName = 'hyphenatedVar';
    const expectedError = `${varName} in not alphanumeric`;

    expect(() => assertAlphanumericNotEmptyAndTrim('invalid-value', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });

  it('should throw a "not alphanumeric" error for a string with spaces inside other characters', () => {
    const varName = 'spacedVar';
    const expectedError = `${varName} in not alphanumeric`;

    expect(() => assertAlphanumericNotEmptyAndTrim('invalid value', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });

  it('should throw a "not alphanumeric" error for a string with special symbols', () => {
    const varName = 'symbolVar';
    const expectedError = `${varName} in not alphanumeric`;

    expect(() => assertAlphanumericNotEmptyAndTrim('value-with-!@#$', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });

  it('should first throw a "can\'t be empty" error for an empty string', () => {
    const varName = 'emptyVar';
    const expectedError = `${varName} can't be empty`;

    // This checks that the `assertNotEmpty` check is correctly called first
    expect(() => assertAlphanumericNotEmptyAndTrim('', varName)).toThrow(expectedError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedError);
  });
});



// --------------- Test for utility function intToStringWithZeroPadding ------------------

describe('intToStringWithZeroPadding', () => {
  it('should pad a small number with leading zeros to the specified length', () => {
    expect(intToStringWithZeroPadding(42, 5)).toBe('00042');
  });

  it('should correctly pad the number 0', () => {
    expect(intToStringWithZeroPadding(0, 4)).toBe('0000');
  });

  it('should not pad if the number is already the correct length', () => {
    expect(intToStringWithZeroPadding(12345, 5)).toBe('12345');
  });

  it('should return an error if the number is not representable with the given string length', () => {
    expect(() => intToStringWithZeroPadding(100000, 5)).toThrow("100000 is not representable with 5 base 10 digits")
  });
});


// --------------- Test for utility function parseSchemaList ------------------

describe('parseSchemaList', () => {
  it('should correctly parse a valid JSON array string into a string array', () => {
    // ARRANGE
    const jsonString = '["schema_a", "schema_b", "schema_c"]';
    
    // ACT
    const result = parseSchemaList(jsonString);

    // ASSERT
    expect(result).toEqual(['schema_a', 'schema_b', 'schema_c']);
  });

  it('should throw an error if the input string is undefined', () => {
    // ARRANGE & ACT & ASSERT
    expect(() => parseSchemaList(undefined)).toThrow("Schema list can't be empty");
  });

  it('should throw a SyntaxError for a malformed JSON string', () => {
    // ARRANGE
    const malformedJson = '["schema_a", "schema_b"'; // Missing closing bracket

    // ACT & ASSERT
    // This checks that the native JSON.parse error is allowed to bubble up.
    expect(() => parseSchemaList(malformedJson)).toThrow(SyntaxError);
  });

  it('should throw an error for json values that are not string array', () => {
    // ARRANGE
    const jsonStringOfWrongType = '["schema_a", "schema_b", 1 ]';
    
    // ACT & ASSERT
    // This checks the type checking
    expect(() => parseSchemaList(jsonStringOfWrongType)).toThrow("Schema list must be a string array in json format.");
  });

});
