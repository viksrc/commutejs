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
    const arrivalTimeStr = `${arrivalTime.getHours()}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;

    console.log(`🚌 Looking for ${direction} bus after ${arrivalTimeStr} on ${dayType}`);

    // Find next bus
    for (const busTime of times) {
      const busMinutes = timeToMinutes(busTime);
      if (busMinutes >= arrivalMinutes) {
        console.log(`  ✅ Found bus at ${busTime} (wait: ${busMinutes - arrivalMinutes} mins)`);
        return {
          departureTime: busTime,
          waitMinutes: busMinutes - arrivalMinutes,
        };
      }
    }

    // No bus found
    console.log(`  ❌ No ${direction} bus available after ${arrivalTimeStr}`);
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
      lastUpdated: schedule.fetchedAt,
      isStale: false, // Backend handles staleness/caching
    };
  } catch {
    return { lastUpdated: null, isStale: true };
  }
}
