import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { RedshiftSnsEventDecoder } from '../../src/RedshiftSnsEventDecoder';

// Helper function to create a mock SNS Record for our tests
const createMockSnsRecord = (message: object, subject: string | null) => ({
  Sns: {
    Message: JSON.stringify(message),
    Subject: subject,
  },
});

// Helper function to create the top-level Lambda event structure
const createMockLambdaEvent = (records: object[]) => ({
  Records: records,
});

describe('RedshiftSnsEventDecoder', () => {
  // --- Mock Event Payloads ---

  const resumeMessage = {
    'Resource': 'my-redshift-cluster ',
    'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-3622 ',
    'Event Time': '2025-09-25 14:00:00.000Z ',
  };
  const pauseMessage = {
    'Resource': 'my-redshift-cluster',
    'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-3618',
    'Event Time': '2025-09-25 15:00:00.000Z',
  };
  const irrelevantMessage = {
    'Resource': 'my-redshift-cluster',
    'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-9999',
    'Event Time': '2025-09-25 16:00:00.000Z',
  };

  const resumeRecord = createMockSnsRecord(resumeMessage, '[Amazon Redshift INFO] - Resume Succeeded.');
  const pauseRecord = createMockSnsRecord(pauseMessage, '[Amazon Redshift INFO] - Pause Started.');
  const irrelevantRecord = createMockSnsRecord(irrelevantMessage, '[Amazon Redshift INFO] - Some other event.');

  // --- Test Suite for Constructor and getRedshiftEvents ---
  describe('constructor and getRedshiftEvents', () => {
    it('should correctly parse a single, valid Redshift resume event', () => {
      const lambdaEvent = createMockLambdaEvent([resumeRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      const events = decoder.getRedshiftEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        code: 'REDSHIFT-EVENT-3622',
        cluster: 'my-redshift-cluster',
        description: '[Amazon Redshift INFO] - Resume Succeeded.',
        timestamp: '2025-09-25 14:00:00.000Z',
      });
    });

    it('should tolerate not "code" empty fields', () => {
      const lambdaEvent = createMockLambdaEvent([
        createMockSnsRecord(
          {
            'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-XYZ ',
          }, 
          'Short message '
        ),
        createMockSnsRecord(
          {
            'Resource': null,
            'Event Time': null,
            'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-XYZ ',
          }, 
          null
        ),
        {
          Sns: {
            Message: JSON.stringify({
              'About this Event': 'Amazon Redshift event notification #REDSHIFT-EVENT-NO_SUBJECT ',
            }),
          }
        }
      ]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      const events = decoder.getRedshiftEvents();

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({
        code: 'REDSHIFT-EVENT-XYZ',
        cluster: null,
        description: 'Short message',
        timestamp: null,
      });
      expect(events[1]).toEqual({
        code: 'REDSHIFT-EVENT-XYZ',
        cluster: null,
        description: null,
        timestamp: null,
      });
      expect(events[2]).toEqual({
        code: 'REDSHIFT-EVENT-NO_SUBJECT',
        cluster: null,
        description: null,
        timestamp: null,
      });
    });

    it('should correctly parse multiple events in one payload', () => {
      const lambdaEvent = createMockLambdaEvent([resumeRecord, pauseRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      const events = decoder.getRedshiftEvents();

      expect(events).toHaveLength(2);
      expect(events[0].code).toBe('REDSHIFT-EVENT-3622');
      expect(events[1].code).toBe('REDSHIFT-EVENT-3618');
    });

    it('should return an empty array for inputs that are not valid objects', () => {
      const decoderNull = new RedshiftSnsEventDecoder(null);
      const decoderString = new RedshiftSnsEventDecoder('not an event');
      const decoderArray = new RedshiftSnsEventDecoder([]);
      const notRedshiftSnsEvent = new RedshiftSnsEventDecoder({ Records: [
        {},
         { Sns: null},
         { Sns: {}}, 
         { Sns: { Message: '{}' }}, 
      ]});

      expect(decoderNull.getRedshiftEvents()).toEqual([]);
      expect(decoderString.getRedshiftEvents()).toEqual([]);
      expect(decoderArray.getRedshiftEvents()).toEqual([]);
      expect(notRedshiftSnsEvent.getRedshiftEvents()).toEqual([]);
    });

    it('should return an empty array if the event has no "Records" property', () => {
      const lambdaEvent = { some: 'other', properties: 'here' };
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getRedshiftEvents()).toEqual([]);
    });

    describe('when Sns.Message is not valid JSON', () => {
      let warnSpy;
      beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      });
      afterEach(() => {
        warnSpy.mockRestore();
      });

      it('should warn and return an empty array of events', () => {
        const malformedRecord = { Sns: { Message: 'this is not json' } };
        const lambdaEvent = createMockLambdaEvent([malformedRecord]);
        const decoder = new RedshiftSnsEventDecoder(lambdaEvent);

        expect(decoder.getRedshiftEvents()).toEqual([]);
        expect(warnSpy).toHaveBeenCalledOnce();
      });
    });
  });

  // --- Test Suite for getScheduleAction ---
  describe('getScheduleAction', () => {
    it('should return "ON" for a resume event', () => {
      const lambdaEvent = createMockLambdaEvent([resumeRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getScheduleAction()).toBe('ON');
    });

    it('should return "OFF" for a pause event', () => {
      const lambdaEvent = createMockLambdaEvent([pauseRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getScheduleAction()).toBe('OFF');
    });

    it('should return null if no events map to an action', () => {
      const lambdaEvent = createMockLambdaEvent([irrelevantRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getScheduleAction()).toBe(null);
    });

    it('should return the LAST valid action if multiple are present', () => {
      // The order is ON, then OFF. The last action is OFF.
      const lambdaEvent = createMockLambdaEvent([resumeRecord, pauseRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getScheduleAction()).toBe('OFF');
    });

    it('should ignore irrelevant events and return the last valid action', () => {
      // The order is OFF, irrelevant, then ON. The last valid action is ON.
      const lambdaEvent = createMockLambdaEvent([pauseRecord, irrelevantRecord, resumeRecord]);
      const decoder = new RedshiftSnsEventDecoder(lambdaEvent);
      expect(decoder.getScheduleAction()).toBe('ON');
    });

    it('should return null for an empty or invalid event payload', () => {
      const decoder = new RedshiftSnsEventDecoder(null);
      expect(decoder.getScheduleAction()).toBe(null);
    });
  });
});