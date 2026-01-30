import { CachedScheduleData, BusDirection, NextBus } from '../types/lakelandBus';
import * as cacheService from './cacheService';
import { FALLBACK_SCHEDULE } from '../config/fallbackSchedule';

const CACHE_KEY = 'lakeland-bus-route46-schedule';

const SCHEDULE_IDS = {
  weekdayEastbound: '25',
  weekdayWestbound: '32',
  weekendEastbound: '26',
  weekendWestbound: '28',
};

// Use our Vercel proxy to avoid CORS issues
const LAKELAND_BASE_URL = '/api/lakeland-bus';

/**
 * Parse schedule HTML to extract times for a specific stop
 */
function parseScheduleHTML(html: string, stopName: string): string[] {
  console.log(`  Looking for stop: "${stopName}"`);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find the row containing the stop name
  const rows = Array.from(doc.querySelectorAll('tr.stop-schedule'));
  console.log(`  Found ${rows.length} rows with class "stop-schedule"`);

  // Log all available stop names for debugging
  if (rows.length > 0) {
    console.log('  Available stops in schedule:');
    rows.forEach((row, idx) => {
      const nameDiv = row.querySelector('.s-name');
      if (nameDiv) {
        console.log(`    ${idx}: "${nameDiv.textContent?.trim()}"`);
      }
    });
  } else {
    console.warn('  No rows found with class "stop-schedule". HTML snippet:', html.substring(0, 500));
  }

  const stopRow = rows.find(row => {
    const nameDiv = row.querySelector('.s-name');
    return nameDiv && nameDiv.textContent?.includes(stopName);
  });

  if (!stopRow) {
    console.warn(`Stop "${stopName}" not found in schedule`);
    return [];
  }

  // Extract all times from the row
  const times: string[] = [];
  const timeCells = stopRow.querySelectorAll('td .s-time span');

  timeCells.forEach(span => {
    const time = span.textContent?.trim();
    if (time && time !== '-') {
      times.push(time);
    }
  });

  return times;
}

/**
 * Add AM/PM to times based on schedule context
 */
function addAmPm(times: string[], direction: BusDirection, isWeekend: boolean): string[] {
  return times.map(time => {
    const [hourStr] = time.split(':');
    const hour = parseInt(hourStr, 10);

    let isAM = false;

    if (direction === 'eastbound') {
      // Morning commute - most times are AM, afternoon service is PM
      if (isWeekend) {
        isAM = hour >= 7 && hour < 12;
      } else {
        // Weekday: 4:50-12:20 AM, 1:20-9:20 PM
        isAM = hour >= 4 && hour <= 12;
      }
    } else {
      // Westbound - evening commute
      if (isWeekend) {
        isAM = hour >= 7 && hour < 12;
      } else {
        // Weekday: 7:30-11:30 AM, 1:00-10:30 PM
        isAM = hour >= 7 && hour < 12;
      }
    }

    return `${time} ${isAM ? 'AM' : 'PM'}`;
  });
}

/**
 * Fetch schedule from Lakeland Bus website
 */
export async function fetchSchedule(): Promise<CachedScheduleData> {
  try {
    console.log('🚌 Fetching Lakeland Bus schedules via proxy...');
    const schedules = await Promise.all([
      fetch(`${LAKELAND_BASE_URL}?id=${SCHEDULE_IDS.weekdayEastbound}`).then(r => r.text()),
      fetch(`${LAKELAND_BASE_URL}?id=${SCHEDULE_IDS.weekdayWestbound}`).then(r => r.text()),
      fetch(`${LAKELAND_BASE_URL}?id=${SCHEDULE_IDS.weekendEastbound}`).then(r => r.text()),
      fetch(`${LAKELAND_BASE_URL}?id=${SCHEDULE_IDS.weekendWestbound}`).then(r => r.text()),
    ]);
    console.log('✅ Lakeland Bus schedules fetched successfully');

    const [weekdayEastHTML, weekdayWestHTML, weekendEastHTML, weekendWestHTML] = schedules;

    console.log('📄 HTML responses received:');
    console.log('  Weekday East:', weekdayEastHTML.length, 'chars');
    console.log('  Weekday West:', weekdayWestHTML.length, 'chars');
    console.log('  Weekend East:', weekendEastHTML.length, 'chars');
    console.log('  Weekend West:', weekendWestHTML.length, 'chars');

    // Parse each schedule
    console.log('🔍 Parsing weekday eastbound...');
    const weekdayEastTimes = parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)');
    console.log('🔍 Parsing weekday westbound...');
    const weekdayWestTimes = parseScheduleHTML(weekdayWestHTML, 'Depart From NY PABT');
    console.log('🔍 Parsing weekend eastbound...');
    const weekendEastTimes = parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)');
    console.log('🔍 Parsing weekend westbound...');
    const weekendWestTimes = parseScheduleHTML(weekendWestHTML, 'Depart From NY PABT');

    // Add AM/PM
    const weekdayEastbound = addAmPm(weekdayEastTimes, 'eastbound', false);
    const weekdayWestbound = addAmPm(weekdayWestTimes, 'westbound', false);
    const weekendEastbound = addAmPm(weekendEastTimes, 'eastbound', true);
    const weekendWestbound = addAmPm(weekendWestTimes, 'westbound', true);

    const scheduleData: CachedScheduleData = {
      timestamp: Date.now(),
      fetchedAt: new Date().toISOString(),
      schedules: {
        weekday: {
          eastbound: weekdayEastbound,
          westbound: weekdayWestbound,
        },
        weekend: {
          eastbound: weekendEastbound,
          westbound: weekendWestbound,
        },
      },
    };

    return scheduleData;
  } catch (error) {
    console.error('Failed to fetch Lakeland Bus schedule:', error);
    throw error;
  }
}

/**
 * Get schedule from cache or fetch if needed
 */
export async function getSchedule(): Promise<CachedScheduleData> {
  const cached = cacheService.get<CachedScheduleData>(CACHE_KEY);

  // Fresh cache (< 24h)
  if (cached && !cacheService.isStale(CACHE_KEY, cacheService.CACHE_TTL.PREFERRED)) {
    return cached.data;
  }

  // Stale cache (1-7 days) - try to fetch, fallback to cache
  if (cached && !cacheService.isStale(CACHE_KEY, cacheService.CACHE_TTL.MAX_STALE)) {
    try {
      const freshData = await fetchSchedule();
      cacheService.set(CACHE_KEY, freshData);
      return freshData;
    } catch (error) {
      console.warn('Failed to refresh stale cache, using cached data:', error);
      return cached.data;
    }
  }

  // Old cache (> 7 days) or no cache - force fetch
  try {
    const freshData = await fetchSchedule();
    cacheService.set(CACHE_KEY, freshData);
    return freshData;
  } catch (error) {
    if (cached) {
      console.warn('Failed to fetch schedule, using very old cache:', error);
      return cached.data;
    }
    console.error('Failed to fetch schedule and no cache available, using fallback:', error);
    return FALLBACK_SCHEDULE;
  }
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;

  let [, hourStr, minuteStr, ampm] = match;
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (ampm.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

/**
 * Find next bus departure after arrival time
 */
export async function findNextBus(arrivalTime: Date, direction: BusDirection): Promise<NextBus | null> {
  try {
    const schedule = await getSchedule();

    // Determine if it's a weekday or weekend
    const dayOfWeek = arrivalTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayType = isWeekend ? 'weekend' : 'weekday';

    const times = schedule.schedules[dayType][direction];

    // Get arrival time in minutes since midnight
    const arrivalMinutes = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();

    // Find next bus
    for (const busTime of times) {
      const busMinutes = timeToMinutes(busTime);
      if (busMinutes >= arrivalMinutes) {
        return {
          departureTime: busTime,
          waitMinutes: busMinutes - arrivalMinutes,
        };
      }
    }

    // No bus found
    return null;
  } catch (error) {
    console.error('Failed to find next bus:', error);
    return null;
  }
}

/**
 * Get schedule metadata for UI display
 */
export function getScheduleMetadata(): { lastUpdated: string | null; isStale: boolean } {
  const cached = cacheService.get<CachedScheduleData>(CACHE_KEY);

  if (!cached) {
    return { lastUpdated: null, isStale: true };
  }

  const isStale = cacheService.isStale(CACHE_KEY, cacheService.CACHE_TTL.PREFERRED);

  return {
    lastUpdated: cached.data.fetchedAt,
    isStale,
  };
}
