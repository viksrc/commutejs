export type BusDirection = 'eastbound' | 'westbound';
export type DayType = 'weekday' | 'weekend';

export interface BusSchedule {
  eastbound: string[];  // e.g., ["5:20 AM", "5:50 AM", ...]
  westbound: string[];  // e.g., ["3:00 PM", "3:15 PM", ...]
}

export interface CachedScheduleData {
  timestamp: number;
  fetchedAt: string;
  schedules: {
    weekday: BusSchedule;
    weekend: BusSchedule;
  };
}

export interface NextBus {
  departureTime: string;  // "6:20 AM"
  waitMinutes: number;    // 15
}
