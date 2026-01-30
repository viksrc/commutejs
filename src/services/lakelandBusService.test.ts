import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSchedule, findNextBus } from './lakelandBusService';

// Real HTML sample from Lakeland Bus website
const SAMPLE_WEEKDAY_EASTBOUND_HTML = `
<div class="schedule-detail-popup">
  <h1>Route 46 Online Monday To Friday</h1>
  <h3>RT.46/80 Weekday Eastbound Schedule</h3>
  <div class="stop-schedule-container">
    <table>
      <tr class="stop-schedule">
        <td class="wg-col-name">
          <div class="s-name">Parsippany (Waterview P&R)</div>
        </td>
        <td><div class="s-time"><span>4:50</span></div></td>
        <td><div class="s-time"><span>5:20</span></div></td>
        <td><div class="s-time"><span>5:50</span></div></td>
      </tr>
      <tr class="stop-schedule">
        <td class="wg-col-name">
          <div class="s-name">NYPABT</div>
        </td>
        <td><div class="s-time"><span>5:45</span></div></td>
        <td><div class="s-time"><span>6:15</span></div></td>
        <td><div class="s-time"><span>6:45</span></div></td>
      </tr>
    </table>
  </div>
</div>
`;

const SAMPLE_WEEKDAY_WESTBOUND_HTML = `
<div class="schedule-detail-popup">
  <h1>Route 46 Online Monday To Friday</h1>
  <h3>Rt. 46/80 Weekday Schedule Westbound</h3>
  <div class="stop-schedule-container">
    <table>
      <tr class="stop-schedule">
        <td class="wg-col-name">
          <div class="s-name">NY PABT</div>
        </td>
        <td><div class="s-time"><span>4:00</span></div></td>
        <td><div class="s-time"><span>4:30</span></div></td>
        <td><div class="s-time"><span>5:00</span></div></td>
      </tr>
      <tr class="stop-schedule">
        <td class="wg-col-name">
          <div class="s-name">Parsippany (Waterview Park and Ride)</div>
        </td>
        <td><div class="s-time"><span>4:55</span></div></td>
        <td><div class="s-time"><span>5:25</span></div></td>
        <td><div class="s-time"><span>5:55</span></div></td>
      </tr>
    </table>
  </div>
</div>
`;

const SAMPLE_WEEKEND_HTML = `
<div class="schedule-detail-popup">
  <h1>Route 46 Online Weekend</h1>
  <div class="stop-schedule-container">
    <table>
      <tr class="stop-schedule">
        <td class="wg-col-name">
          <div class="s-name">Parsippany (Waterview P&R)</div>
        </td>
        <td><div class="s-time"><span>7:00</span></div></td>
        <td><div class="s-time"><span>9:00</span></div></td>
      </tr>
    </table>
  </div>
</div>
`;

describe('lakelandBusService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('fetchSchedule', () => {
    it('should fetch and parse all four schedules', async () => {
      // Mock the fetch function with proper type checking
      global.fetch = vi.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        console.log('Mocking fetch for URL:', url);

        // Return different HTML based on the schedule ID
        if (url.includes('id=25')) {
          console.log('Returning weekday eastbound HTML');
          return Promise.resolve({
            ok: true,
            text: async () => SAMPLE_WEEKDAY_EASTBOUND_HTML,
          } as Response);
        } else if (url.includes('id=32')) {
          console.log('Returning weekday westbound HTML');
          return Promise.resolve({
            ok: true,
            text: async () => SAMPLE_WEEKDAY_WESTBOUND_HTML,
          } as Response);
        } else if (url.includes('id=26')) {
          console.log('Returning weekend eastbound HTML');
          return Promise.resolve({
            ok: true,
            text: async () => SAMPLE_WEEKEND_HTML,
          } as Response);
        } else if (url.includes('id=28')) {
          console.log('Returning weekend westbound HTML (gate)');
          // Weekend westbound uses different naming
          return Promise.resolve({
            ok: true,
            text: async () => SAMPLE_WEEKEND_HTML.replace('Parsippany', 'LEAVES FROM GATE #'),
          } as Response);
        }
        console.error('Unknown schedule ID in URL:', url);
        return Promise.reject(new Error(`Unknown schedule ID in ${url}`));
      });

      const schedule = await fetchSchedule();

      expect(schedule).toBeDefined();
      expect(schedule.schedules).toBeDefined();

      // Check weekday schedules
      expect(schedule.schedules.weekday.eastbound).toBeDefined();
      expect(schedule.schedules.weekday.westbound).toBeDefined();

      // Check weekend schedules
      expect(schedule.schedules.weekend.eastbound).toBeDefined();
      expect(schedule.schedules.weekend.westbound).toBeDefined();

      // Verify fetch was called 4 times
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('should parse Parsippany (Waterview P&R) stop correctly', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => SAMPLE_WEEKDAY_EASTBOUND_HTML,
        } as Response)
      );

      const schedule = await fetchSchedule();

      // Should have parsed times for Waterview P&R
      expect(schedule.schedules.weekday.eastbound.length).toBeGreaterThan(0);

      // Times should have AM/PM added
      expect(schedule.schedules.weekday.eastbound[0]).toMatch(/\d+:\d+\s+(AM|PM)/);

      console.log('Parsed eastbound times:', schedule.schedules.weekday.eastbound);
    });

    it('should parse NY PABT stop correctly', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => SAMPLE_WEEKDAY_WESTBOUND_HTML,
        } as Response)
      );

      const schedule = await fetchSchedule();

      // Should have parsed times for NY PABT
      expect(schedule.schedules.weekday.westbound.length).toBeGreaterThan(0);

      // Times should have AM/PM added
      expect(schedule.schedules.weekday.westbound[0]).toMatch(/\d+:\d+\s+(AM|PM)/);

      console.log('Parsed westbound times:', schedule.schedules.weekday.westbound);
    });

    it('should handle empty schedules gracefully', async () => {
      const emptyHTML = '<div class="schedule-detail-popup"></div>';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => emptyHTML,
        } as Response)
      );

      const schedule = await fetchSchedule();

      // Should return schedule with empty arrays
      expect(schedule.schedules.weekday.eastbound).toEqual([]);
      expect(schedule.schedules.weekday.westbound).toEqual([]);
    });

    it('should throw error on fetch failure', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(fetchSchedule()).rejects.toThrow('Network error');
    });
  });

  describe('findNextBus', () => {
    it('should find next bus after arrival time', async () => {
      // Set up mock schedule in cache
      const mockSchedule = {
        timestamp: Date.now(),
        fetchedAt: new Date().toISOString(),
        schedules: {
          weekday: {
            eastbound: ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM'],
            westbound: ['5:00 PM', '6:00 PM', '7:00 PM'],
          },
          weekend: {
            eastbound: ['8:00 AM', '10:00 AM'],
            westbound: ['2:00 PM', '4:00 PM'],
          },
        },
      };

      localStorage.setItem(
        'lakeland-bus-route46-schedule',
        JSON.stringify({
          data: mockSchedule,
          timestamp: Date.now(),
        })
      );

      // Test finding bus at 6:30 AM on a Monday
      const testDate = new Date('2024-01-15T06:30:00'); // Monday
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      expect(result?.departureTime).toBe('7:00 AM');
      expect(result?.waitMinutes).toBe(30);
    });

    it('should return null if no bus is available', async () => {
      const mockSchedule = {
        timestamp: Date.now(),
        fetchedAt: new Date().toISOString(),
        schedules: {
          weekday: {
            eastbound: ['6:00 AM', '7:00 AM'],
            westbound: [],
          },
          weekend: {
            eastbound: [],
            westbound: [],
          },
        },
      };

      localStorage.setItem(
        'lakeland-bus-route46-schedule',
        JSON.stringify({
          data: mockSchedule,
          timestamp: Date.now(),
        })
      );

      // Test after last bus
      const testDate = new Date('2024-01-15T20:00:00'); // 8 PM Monday
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeNull();
    });

    it('should handle weekend schedules correctly', async () => {
      const mockSchedule = {
        timestamp: Date.now(),
        fetchedAt: new Date().toISOString(),
        schedules: {
          weekday: {
            eastbound: ['6:00 AM'],
            westbound: [],
          },
          weekend: {
            eastbound: ['8:00 AM', '10:00 AM', '12:00 PM'],
            westbound: [],
          },
        },
      };

      localStorage.setItem(
        'lakeland-bus-route46-schedule',
        JSON.stringify({
          data: mockSchedule,
          timestamp: Date.now(),
        })
      );

      // Test on Saturday at 9 AM
      const testDate = new Date('2024-01-13T09:00:00'); // Saturday
      const result = await findNextBus(testDate, 'eastbound');

      expect(result).toBeDefined();
      expect(result?.departureTime).toBe('10:00 AM');
      expect(result?.waitMinutes).toBe(60);
    });
  });

  describe('HTML parsing edge cases', () => {
    it('should handle extra whitespace in stop names', async () => {
      const htmlWithWhitespace = `
        <div class="schedule-detail-popup">
          <table>
            <tr class="stop-schedule">
              <td class="wg-col-name">
                <div class="s-name">
                  Parsippany (Waterview P&R)
                </div>
              </td>
              <td><div class="s-time"><span>5:00</span></div></td>
            </tr>
          </table>
        </div>
      `;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => htmlWithWhitespace,
        } as Response)
      );

      const schedule = await fetchSchedule();

      // Should still find the stop and parse times
      expect(schedule.schedules.weekday.eastbound.length).toBeGreaterThan(0);
    });

    it('should skip times with dashes or special characters', async () => {
      const htmlWithDashes = `
        <div class="schedule-detail-popup">
          <table>
            <tr class="stop-schedule">
              <td class="wg-col-name">
                <div class="s-name">Parsippany (Waterview P&R)</div>
              </td>
              <td><div class="s-time"><span>5:00</span></div></td>
              <td><div class="s-time"><span>-</span></div></td>
              <td><div class="s-time"><span>6:00</span></div></td>
            </tr>
          </table>
        </div>
      `;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: async () => htmlWithDashes,
        } as Response)
      );

      const schedule = await fetchSchedule();

      // Should parse 2 times (skipping the dash)
      expect(schedule.schedules.weekday.eastbound.length).toBe(2);
      expect(schedule.schedules.weekday.eastbound).not.toContain('-');
    });
  });
});
