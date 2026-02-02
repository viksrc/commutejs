import { CachedScheduleData } from '../types/lakelandBus';

/**
 * Fallback schedule for Lakeland Bus Route 46
 * Used when dynamic fetching fails and cache is unavailable/too old
 * Manually transcribed from https://www.lakelandbus.com/route46/
 * Last verified: 2026-01-29
 *
 * Times are in 24-hour "HH:MM" format, America/New_York timezone
 */
export const FALLBACK_SCHEDULE: CachedScheduleData = {
  timestamp: Date.now(),
  fetchedAt: '2026-01-29 (Hardcoded Fallback)',
  schedules: {
    weekday: {
      eastbound: [
        "04:50", "05:20", "05:50", "06:20", "06:50",
        "07:20", "07:50", "08:20", "08:50", "09:20",
        "10:20", "11:20", "12:20", "13:20", "14:20",
        "15:20", "16:20", "17:20", "18:20", "19:20",
        "20:20", "21:20"
      ],
      westbound: [
        "07:30", "08:30", "09:30", "10:30", "11:30",
        "13:00", "14:00", "14:30", "15:00", "15:15",
        "15:30", "15:45", "16:00", "16:15", "16:30",
        "16:45", "17:00", "17:15", "17:30", "17:45",
        "18:00", "18:15", "18:30", "19:00", "19:30",
        "20:30", "21:30", "22:30"
      ]
    },
    weekend: {
      eastbound: [
        "07:20", "09:20", "11:20", "13:20", "15:20",
        "17:20", "19:20", "21:20"
      ],
      westbound: [
        "09:00", "11:00", "13:00", "15:00", "17:00",
        "19:00", "21:00", "23:00"
      ]
    }
  }
};
