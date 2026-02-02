import { describe, it, expect } from 'vitest';

/**
 * Integration test for Lakeland Bus schedule API
 * Tests REAL API calls to verify the backend returns valid schedule data
 */

const VERCEL_API_URL = 'https://commutejs.vercel.app/api/lakeland-bus';

interface BusSchedule {
  eastbound: string[];
  westbound: string[];
}

interface ScheduleResponse {
  timestamp: number;
  schedules: {
    weekday: BusSchedule;
    weekend: BusSchedule;
  };
}

describe('Lakeland Bus Schedule - Integration Test', () => {
  it('should fetch schedule JSON with valid data', async () => {
    console.log('\n🧪 INTEGRATION TEST: Fetching schedule from Vercel API\n');
    console.log('━'.repeat(60));

    console.log('\n📡 Fetching schedule...');
    const response = await fetch(VERCEL_API_URL);

    expect(response.ok, 'API should return 200').toBe(true);

    const data: ScheduleResponse = await response.json();

    console.log('✅ Received JSON response');
    console.log(`   Timestamp: ${new Date(data.timestamp).toISOString()}`);

    // Validate structure
    expect(data.schedules).toBeDefined();
    expect(data.schedules.weekday).toBeDefined();
    expect(data.schedules.weekend).toBeDefined();

    const { weekday, weekend } = data.schedules;

    // Print results
    console.log('\n📊 SCHEDULE DATA');
    console.log('━'.repeat(60));

    console.log('\n1️⃣  WEEKDAY EASTBOUND');
    console.log(`   ${weekday.eastbound.length} buses`);
    if (weekday.eastbound.length > 0) {
      console.log(`   First: ${weekday.eastbound[0]}, Last: ${weekday.eastbound[weekday.eastbound.length - 1]}`);
    }

    console.log('\n2️⃣  WEEKDAY WESTBOUND');
    console.log(`   ${weekday.westbound.length} buses`);
    if (weekday.westbound.length > 0) {
      console.log(`   First: ${weekday.westbound[0]}, Last: ${weekday.westbound[weekday.westbound.length - 1]}`);
    }

    console.log('\n3️⃣  WEEKEND EASTBOUND');
    console.log(`   ${weekend.eastbound.length} buses`);
    if (weekend.eastbound.length > 0) {
      console.log(`   Times: ${weekend.eastbound.join(', ')}`);
    }

    console.log('\n4️⃣  WEEKEND WESTBOUND');
    console.log(`   ${weekend.westbound.length} buses`);
    if (weekend.westbound.length > 0) {
      console.log(`   Times: ${weekend.westbound.join(', ')}`);
    }

    // Assertions - schedules should have times
    console.log('\n🧪 Running assertions...');
    expect(weekday.eastbound.length, 'Weekday Eastbound should have times').toBeGreaterThan(0);
    expect(weekday.westbound.length, 'Weekday Westbound should have times').toBeGreaterThan(0);
    expect(weekend.eastbound.length, 'Weekend Eastbound should have times').toBeGreaterThan(0);
    expect(weekend.westbound.length, 'Weekend Westbound should have times').toBeGreaterThan(0);

    // Validate time format - either HH:MM (new) or "H:MM AM/PM" (old, before deploy)
    const time = weekday.eastbound[0];
    const is24HourFormat = /^\d{2}:\d{2}$/.test(time);
    const is12HourFormat = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(time);
    expect(is24HourFormat || is12HourFormat, `Time "${time}" should be valid format`).toBe(true);

    if (is24HourFormat) {
      console.log('✅ API returns new 24-hour format (HH:MM)');
    } else {
      console.log('⚠️  API still returns old 12-hour format - deploy needed');
    }

    console.log('✅ All assertions passed!\n');
    console.log('━'.repeat(60));
  }, 30000);
});
