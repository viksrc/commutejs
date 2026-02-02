import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSchedule, findNextBus } from './lakelandBusService';

describe('lakelandBusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSchedule', () => {
    it('should fetch schedule from backend API', async () => {
      const mockSchedule = {
        timestamp: Date.now(),
        fetchedAt: '2026-01-29',
        schedules: {
          weekday: {
            eastbound: ['04:50', '05:20', '05:50', '06:20'],
            westbound: ['16:00', '16:30', '17:00'],
          },
          weekend: {
            eastbound: ['07:20', '09:20'],
            westbound: ['09:00', '11:00'],
          },
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockSchedule,
        } as Response)
      );

      const schedule = await fetchSchedule();

      expect(schedule).toBeDefined();
      expect(schedule.schedules).toBeDefined();
      expect(schedule.schedules.weekday.eastbound).toEqual(['04:50', '05:20', '05:50', '06:20']);
      expect(schedule.schedules.weekday.westbound).toEqual(['16:00', '16:30', '17:00']);
      expect(fetch).toHaveBeenCalledWith('/api/lakeland-bus');
    });

    it('should return fallback schedule on API error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response)
      );

      const schedule = await fetchSchedule();

      expect(schedule).toBeDefined();
      expect(schedule.schedules.weekday.eastbound.length).toBeGreaterThan(0);
      expect(schedule.schedules.weekday.eastbound[0]).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return fallback schedule on network error', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      const schedule = await fetchSchedule();

      expect(schedule).toBeDefined();
      expect(schedule.schedules.weekday.eastbound.length).toBeGreaterThan(0);
    });
  });

  describe('findNextBus', () => {
    const createMockSchedule = (weekdayEast: string[], weekdayWest: string[] = [], weekendEast: string[] = [], weekendWest: string[] = []) => ({
      timestamp: Date.now(),
      fetchedAt: '2026-01-29',
      schedules: {
        weekday: { eastbound: weekdayEast, westbound: weekdayWest },
        weekend: { eastbound: weekendEast, westbound: weekendWest },
      },
    });

    const mockFetch = (schedule: ReturnType<typeof createMockSchedule>) => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => schedule,
        } as Response)
      );
    };

    it('should return ISO 8601 UTC string', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00', '08:00']));

      const testDate = new Date('2026-02-02T11:30:00Z'); // 6:30 AM ET (EST)
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      expect(result?.departureTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should NOT return waitMinutes (removed in refactor)', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00']));

      const testDate = new Date('2026-02-02T11:30:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect((result as any)?.waitMinutes).toBeUndefined();
    });

    it('should find next bus when arriving before first bus', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00', '08:00']));

      // 5:00 AM ET = 10:00 UTC (EST)
      const testDate = new Date('2026-02-02T10:00:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 6:00 AM ET = 11:00 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(11);
      expect(resultDate.getUTCMinutes()).toBe(0);
    });

    it('should find next bus when arriving between buses', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00', '08:00']));

      // 6:30 AM ET = 11:30 UTC (EST)
      const testDate = new Date('2026-02-02T11:30:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 7:00 AM ET = 12:00 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(12);
      expect(resultDate.getUTCMinutes()).toBe(0);
    });

    it('should return bus at exact arrival time', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00', '08:00']));

      // Exactly 7:00 AM ET = 12:00 UTC (EST)
      const testDate = new Date('2026-02-02T12:00:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 7:00 AM ET (the exact match)
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(12);
    });

    it('should return null after last bus', async () => {
      mockFetch(createMockSchedule(['06:00', '07:00']));

      // 8:00 PM ET = 01:00 UTC next day (EST)
      const testDate = new Date('2026-02-03T01:00:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeNull();
    });

    it('should return null for empty schedule', async () => {
      mockFetch(createMockSchedule([]));

      const testDate = new Date('2026-02-02T12:00:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeNull();
    });

    it('should use weekend schedule on Saturday', async () => {
      // Weekday has 6 AM bus, weekend has 8 AM bus
      mockFetch(createMockSchedule(['06:00'], [], ['08:00', '10:00']));

      // Saturday Feb 1, 2026 at 7:00 AM ET = 12:00 UTC
      const testDate = new Date('2026-01-31T12:00:00Z'); // This is a Saturday
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 8:00 AM (weekend schedule), not 6:00 AM (weekday)
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(13); // 8 AM ET = 13:00 UTC
    });

    it('should use weekend schedule on Sunday', async () => {
      mockFetch(createMockSchedule(['06:00'], [], ['09:00']));

      // Sunday Feb 2, 2026 at 8:00 AM ET = 13:00 UTC
      const testDate = new Date('2026-02-01T13:00:00Z'); // This is a Sunday
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(14); // 9 AM ET = 14:00 UTC
    });

    it('should handle westbound direction', async () => {
      mockFetch(createMockSchedule([], ['17:00', '18:00']));

      // 4:30 PM ET = 21:30 UTC (EST)
      const testDate = new Date('2026-02-02T21:30:00Z');
      const result = await findNextBus(testDate, 'westbound');

      expect(result).toBeDefined();
      // Should get 5:00 PM ET = 22:00 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(22);
    });

    it('should handle noon correctly', async () => {
      mockFetch(createMockSchedule(['11:00', '12:00', '13:00']));

      // 11:30 AM ET = 16:30 UTC (EST)
      const testDate = new Date('2026-02-02T16:30:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 12:00 PM ET = 17:00 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(17);
    });

    it('should handle early morning times correctly', async () => {
      mockFetch(createMockSchedule(['04:50', '05:20', '05:50']));

      // 4:00 AM ET = 09:00 UTC (EST)
      const testDate = new Date('2026-02-02T09:00:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 4:50 AM ET = 09:50 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(9);
      expect(resultDate.getUTCMinutes()).toBe(50);
    });

    it('should handle late evening times correctly', async () => {
      mockFetch(createMockSchedule(['20:00', '21:00', '22:00']));

      // 8:30 PM ET = 01:30 UTC next day (EST)
      const testDate = new Date('2026-02-03T01:30:00Z');
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      // Should get 9:00 PM ET = 02:00 UTC
      const resultDate = new Date(result!.departureTime);
      expect(resultDate.getUTCHours()).toBe(2);
    });
  });
});

/**
 * Test the scheduleTimeToUTC function directly
 * This is the core timezone conversion that was broken before
 */
describe('scheduleTimeToUTC (via findNextBus behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // These tests verify the UTC conversion is correct by checking findNextBus output
  // Since scheduleTimeToUTC is not exported, we test it through findNextBus

  it('should convert morning time to correct UTC (EST, UTC-5)', async () => {
    const mockSchedule = {
      timestamp: Date.now(),
      schedules: {
        weekday: { eastbound: ['09:20'], westbound: [] },
        weekend: { eastbound: [], westbound: [] },
      },
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => mockSchedule } as Response)
    );

    // Request bus after 9:00 AM ET
    // 9:00 AM ET in EST = 14:00 UTC
    const testDate = new Date('2026-02-02T14:00:00Z');
    const result = await findNextBus(testDate, 'eastbound');

    expect(result).toBeDefined();
    // 9:20 AM ET = 14:20 UTC (EST is UTC-5)
    const resultDate = new Date(result!.departureTime);
    expect(resultDate.toISOString()).toBe('2026-02-02T14:20:00.000Z');
  });

  it('should handle times that cross into next UTC day', async () => {
    const mockSchedule = {
      timestamp: Date.now(),
      schedules: {
        weekday: { eastbound: ['21:20'], westbound: [] },
        weekend: { eastbound: [], westbound: [] },
      },
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => mockSchedule } as Response)
    );

    // Request bus after 9:00 PM ET
    // 9:00 PM ET in EST = 02:00 UTC next day
    const testDate = new Date('2026-02-03T02:00:00Z');
    const result = await findNextBus(testDate, 'eastbound');

    expect(result).toBeDefined();
    // 9:20 PM ET = 02:20 UTC next day
    const resultDate = new Date(result!.departureTime);
    expect(resultDate.getUTCHours()).toBe(2);
    expect(resultDate.getUTCMinutes()).toBe(20);
  });
});
