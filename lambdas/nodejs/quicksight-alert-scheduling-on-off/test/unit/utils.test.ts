import { describe, it, expect } from 'vitest';
import { checkOnOffAction } from '../../src/utils';

describe('checkOnOffAction', () => {
  // Test the successful 'ON' case
  it('should return "ON" when the actionValue is "ON"', () => {
    const result = checkOnOffAction('ON', 'scheduleAction');
    expect(result).toBe('ON');
  });

  // Test the successful 'OFF' case
  it('should return "OFF" when the actionValue is "OFF"', () => {
    const result = checkOnOffAction('OFF', 'scheduleAction');
    expect(result).toBe('OFF');
  });

  // Test the error-throwing case for an invalid value
  it('should throw an error for an invalid actionValue', () => {
    const invalidValue = 'INVALID';
    const actionName = 'scheduleAction';
    
    // We wrap the function call in an arrow function to test that it throws.
    const action = () => checkOnOffAction(invalidValue, actionName);

    // Assert that the function throws an error with the expected message.
    expect(action).toThrow(
      `Action ${actionName} is an ON/OFF action, value '${invalidValue}' is not allowed`
    );
  });

  // Test the case-sensitivity to ensure "on" is not accepted
  it('should be case-sensitive and throw an error for "on"', () => {
    const invalidValue = 'on';
    const actionName = 'scheduleAction';
    
    const action = () => checkOnOffAction(invalidValue, actionName);

    expect(action).toThrow();
  });

  // Test with an empty string
  it('should throw an error for an empty string', () => {
    const action = () => checkOnOffAction('', 'scheduleAction');
    expect(action).toThrow();
  });
});
