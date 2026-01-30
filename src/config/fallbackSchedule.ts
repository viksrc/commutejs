import { CachedScheduleData } from '../types/lakelandBus';

/**
 * Fallback schedule for Lakeland Bus Route 46
 * Used when dynamic fetching fails and cache is unavailable/too old
 * Manually transcribed from https://www.lakelandbus.com/route46/
 * Last verified: 2026-01-29
 */
export const FALLBACK_SCHEDULE: CachedScheduleData = {
  timestamp: Date.now(),
  fetchedAt: '2026-01-29 (Hardcoded Fallback)',
  schedules: {
    weekday: {
      eastbound: [
        "4:50 AM", "5:20 AM", "5:50 AM", "6:20 AM", "6:50 AM",
        "7:20 AM", "7:50 AM", "8:20 AM", "8:50 AM", "9:20 AM",
        "10:20 AM", "11:20 AM", "12:20 PM", "1:20 PM", "2:20 PM",
        "3:20 PM", "4:20 PM", "5:20 PM", "6:20 PM", "7:20 PM",
        "8:20 PM", "9:20 PM"
      ],
      westbound: [
        "7:30 AM", "8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM",
        "1:00 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:15 PM",
        "3:30 PM", "3:45 PM", "4:00 PM", "4:15 PM", "4:30 PM",
        "4:45 PM", "5:00 PM", "5:15 PM", "5:30 PM", "5:45 PM",
        "6:00 PM", "6:15 PM", "6:30 PM", "7:00 PM", "7:30 PM",
        "8:30 PM", "9:30 PM", "10:30 PM"
      ]
    },
    weekend: {
      eastbound: [
        "7:20 AM", "9:20 AM", "11:20 AM", "1:20 PM", "3:20 PM",
        "5:20 PM", "7:20 PM", "9:20 PM"
      ],
      westbound: [
        "9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:00 PM",
        "7:00 PM", "9:00 PM", "11:00 PM"
      ]
    }
  }
};
