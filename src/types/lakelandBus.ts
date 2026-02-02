export type BusDirection = 'eastbound' | 'westbound';
export type DayType = 'weekday' | 'weekend';

export interface BusSchedule {
  eastbound: string[];  // "HH:MM" format (24-hour, America/New_York timezone)
  westbound: string[];  // "HH:MM" format (24-hour, America/New_York timezone)
}

export interface CachedScheduleData {
  timestamp: number;
  fetchedAt?: string;
  schedules: {
    weekday: BusSchedule;
    weekend: BusSchedule;
  };
}

export interface NextBus {
  departureTime: string;  // ISO 8601 UTC format (e.g., "2026-02-02T14:50:00.000Z")
}
