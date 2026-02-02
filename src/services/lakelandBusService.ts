import { CachedScheduleData, BusDirection, NextBus } from '../types/lakelandBus';
import { FALLBACK_SCHEDULE } from '../config/fallbackSchedule';

// API Endpoint
const LAKELAND_API_URL = '/api/lakeland-bus';

/**
 * Get schedule from backend API
 */
export async function getSchedule(): Promise<CachedScheduleData> {
  try {
    console.log('🚌 Fetching schedule from backend API...');
    const response = await fetch(LAKELAND_API_URL);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Schedule received from backend');
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch schedule from backend:', error);
    return FALLBACK_SCHEDULE;
  }
}

/**
 * Fetch schedule directly (alias for getSchedule now that logic moved to backend)
 */
export async function fetchSchedule(): Promise<CachedScheduleData> {
  return getSchedule();
}

/**
 * Convert schedule time (HH:MM in NY timezone) to UTC Date for today
 */
function scheduleTimeToUTC(scheduleTime: string): Date {
  const [hours, minutes] = scheduleTime.split(':').map(Number);

  // Get today's date in NY timezone
  const now = new Date();
  const nyDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [year, month, day] = nyDateStr.split('-').map(Number);

  // NY is UTC-5 (EST) or UTC-4 (EDT). Try both offsets to find the correct one.
  for (const offsetHours of [5, 4]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hours + offsetHours, minutes, 0, 0));

    // Verify this gives us the right NY time
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

  // Fallback to EST (UTC-5)
  return new Date(Date.UTC(year, month - 1, day, hours + 5, minutes, 0, 0));
}

/**
 * Find next bus departure after arrival time
 * Returns ISO 8601 UTC string
 */
export async function findNextBus(arrivalTime: Date, direction: BusDirection): Promise<NextBus | null> {
  try {
    const schedule = await getSchedule();

    // Determine if it's a weekday or weekend in NY timezone
    const nyDayStr = arrivalTime.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short'
    });
    const isWeekend = nyDayStr === 'Sat' || nyDayStr === 'Sun';
    const dayType = isWeekend ? 'weekend' : 'weekday';

    const times = schedule.schedules[dayType][direction];
    if (!times || times.length === 0) return null;

    console.log(`🚌 Looking for ${direction} bus after ${arrivalTime.toISOString()} on ${dayType}`);

    // Find first bus that departs after arrivalTime
    for (const timeStr of times) {
      const busTimeUTC = scheduleTimeToUTC(timeStr);
      if (busTimeUTC >= arrivalTime) {
        console.log(`  ✅ Found bus at ${timeStr} (${busTimeUTC.toISOString()})`);
        return {
          departureTime: busTimeUTC.toISOString(),
        };
      }
    }

    // No bus found
    console.log(`  ❌ No ${direction} bus available after ${arrivalTime.toISOString()}`);
    return null;
  } catch (error) {
    console.error('Failed to find next bus:', error);
    return null;
  }
}

/**
 * Get schedule metadata for UI display
 */
export async function getScheduleMetadata(): Promise<{ lastUpdated: string | null; isStale: boolean }> {
  try {
    const schedule = await getSchedule();
    return {
      lastUpdated: schedule.fetchedAt || null,
      isStale: false, // Backend handles staleness/caching
    };
  } catch {
    return { lastUpdated: null, isStale: true };
  }
}
