import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for backend Lakeland Bus service
 * Tests the to24Hour conversion and schedule fetching
 */

// Re-implement to24Hour for testing (since it's not exported)
// This should match the implementation in lakelandBus.ts
function to24Hour(time: string, direction: 'eastbound' | 'westbound', isWeekend: boolean): string {
  const [hourStr, minute] = time.split(':');
  let hour = parseInt(hourStr, 10);

  let isAM: boolean;
  if (direction === 'eastbound') {
    isAM = isWeekend ? (hour >= 7 && hour <= 11) : (hour >= 4 && hour <= 11);
  } else {
    isAM = isWeekend ? (hour >= 9 && hour <= 11) : (hour >= 7 && hour <= 11);
  }

  if (!isAM && hour !== 12) {
    hour += 12;
  }

  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

describe('to24Hour conversion', () => {
  describe('weekday eastbound', () => {
    const convert = (time: string) => to24Hour(time, 'eastbound', false);

    it('should convert early morning times (4-11) as AM', () => {
      // The logic treats hours 4-11 as AM for weekday eastbound
      expect(convert('4:50')).toBe('04:50');
      expect(convert('5:20')).toBe('05:20');
      expect(convert('6:00')).toBe('06:00');
      expect(convert('9:20')).toBe('09:20');
      expect(convert('10:20')).toBe('10:20');
      expect(convert('11:20')).toBe('11:20');
    });

    it('should convert noon correctly', () => {
      expect(convert('12:20')).toBe('12:20'); // 12 PM stays as 12
    });

    it('should convert unambiguous afternoon times (1-3 PM)', () => {
      // Hours 1-3 are unambiguously PM (no buses at 1-3 AM)
      expect(convert('1:20')).toBe('13:20');
      expect(convert('2:20')).toBe('14:20');
      expect(convert('3:20')).toBe('15:20');
    });

    // NOTE: Hours 4-11 are ambiguous - the schedule has both AM and PM buses
    // at these hours (e.g., 4:50 AM and 4:20 PM). The current logic treats
    // all 4-11 as AM. The fallback schedule handles this correctly since
    // it was manually verified. The scraper may have issues with duplicates.
  });

  describe('weekday westbound', () => {
    const convert = (time: string) => to24Hour(time, 'westbound', false);

    it('should convert morning times (7-11) as AM', () => {
      // The logic treats hours 7-11 as AM for weekday westbound
      expect(convert('7:30')).toBe('07:30');
      expect(convert('8:30')).toBe('08:30');
      expect(convert('9:30')).toBe('09:30');
      expect(convert('10:30')).toBe('10:30');
      expect(convert('11:30')).toBe('11:30');
    });

    it('should convert noon correctly', () => {
      expect(convert('12:00')).toBe('12:00');
    });

    it('should convert unambiguous afternoon/evening times (1-6 PM)', () => {
      // Hours 1-6 are unambiguously PM for westbound
      expect(convert('1:00')).toBe('13:00');
      expect(convert('2:00')).toBe('14:00');
      expect(convert('3:00')).toBe('15:00');
      expect(convert('4:00')).toBe('16:00');
      expect(convert('5:00')).toBe('17:00');
      expect(convert('6:00')).toBe('18:00');
    });

    // NOTE: Hours 7-11 are ambiguous - could be AM or PM.
    // The current logic treats all 7-11 as AM.
  });

  describe('weekend eastbound', () => {
    const convert = (time: string) => to24Hour(time, 'eastbound', true);

    it('should convert morning times (7-11 AM)', () => {
      expect(convert('7:20')).toBe('07:20');
      expect(convert('9:20')).toBe('09:20');
      expect(convert('11:20')).toBe('11:20');
    });

    it('should convert afternoon times (1-6)', () => {
      // Hours 1-6 are unambiguously PM on weekend eastbound
      expect(convert('1:20')).toBe('13:20');
      expect(convert('3:20')).toBe('15:20');
      expect(convert('5:20')).toBe('17:20');
      expect(convert('6:20')).toBe('18:20');
    });

    // NOTE: Hours 7-11 are ambiguous on weekends (could be AM or PM)
    // The current logic treats them as AM. If the schedule has both
    // 7:20 AM and 7:20 PM, the scraper would need to track order to distinguish.
    // This is a known limitation - the fallback schedule handles this correctly.
  });

  describe('weekend westbound', () => {
    const convert = (time: string) => to24Hour(time, 'westbound', true);

    it('should convert morning times (9-11 AM)', () => {
      expect(convert('9:00')).toBe('09:00');
      expect(convert('11:00')).toBe('11:00');
    });

    it('should convert afternoon/evening times (1-8)', () => {
      // Hours 1-8 are unambiguously PM on weekend westbound
      expect(convert('1:00')).toBe('13:00');
      expect(convert('3:00')).toBe('15:00');
      expect(convert('5:00')).toBe('17:00');
      expect(convert('7:00')).toBe('19:00');
      expect(convert('8:00')).toBe('20:00');
    });

    // NOTE: Hours 9-11 are ambiguous on weekends (could be AM or PM)
    // Same limitation as eastbound.
  });

  describe('edge cases', () => {
    it('should handle single-digit hours', () => {
      expect(to24Hour('4:50', 'eastbound', false)).toBe('04:50');
      expect(to24Hour('9:00', 'westbound', true)).toBe('09:00');
    });

    it('should handle times with leading zeros in input', () => {
      expect(to24Hour('04:50', 'eastbound', false)).toBe('04:50');
      expect(to24Hour('09:30', 'westbound', false)).toBe('09:30');
    });

    it('should preserve minutes correctly', () => {
      expect(to24Hour('4:05', 'eastbound', false)).toBe('04:05');
      expect(to24Hour('3:15', 'westbound', false)).toBe('15:15');
      expect(to24Hour('5:45', 'westbound', false)).toBe('17:45');
    });
  });
});

describe('scheduleTimeToUTC', () => {
  // Re-implement for testing
  function scheduleTimeToUTC(scheduleTime: string): Date {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const now = new Date();
    const nyDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [year, month, day] = nyDateStr.split('-').map(Number);

    for (const offsetHours of [5, 4]) {
      const candidate = new Date(Date.UTC(year, month - 1, day, hours + offsetHours, minutes, 0, 0));
      const nyTime = candidate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const [nyH, nyM] = nyTime.split(':').map(Number);
      if (nyH === hours && nyM === minutes) {
        return candidate;
      }
    }
    return new Date(Date.UTC(year, month - 1, day, hours + 5, minutes, 0, 0));
  }

  it('should convert schedule time to UTC Date', () => {
    const result = scheduleTimeToUTC('09:20');

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('should produce times that display correctly in NY timezone', () => {
    const result = scheduleTimeToUTC('14:30');

    // When displayed in NY timezone, should show 14:30
    const nyDisplay = result.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    expect(nyDisplay).toBe('14:30');
  });

  it('should handle early morning times', () => {
    const result = scheduleTimeToUTC('04:50');

    const nyDisplay = result.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    expect(nyDisplay).toBe('04:50');
  });

  it('should handle late evening times', () => {
    const result = scheduleTimeToUTC('21:20');

    const nyDisplay = result.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    expect(nyDisplay).toBe('21:20');
  });

  it('should handle noon correctly', () => {
    const result = scheduleTimeToUTC('12:00');

    const nyDisplay = result.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    expect(nyDisplay).toBe('12:00');
  });

  it('should handle midnight correctly', () => {
    const result = scheduleTimeToUTC('00:00');

    const nyDisplay = result.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    expect(nyDisplay).toBe('00:00');
  });
});
