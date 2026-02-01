import { describe, it, expect } from 'vitest';

/**
 * Integration test for Lakeland Bus schedule fetching
 * Tests REAL API calls to verify parsing works correctly
 */

const VERCEL_API_URL = 'https://commutejs.vercel.app/api/lakeland-bus';

const SCHEDULE_IDS = {
  weekdayEastbound: '25',
  weekdayWestbound: '32',
  weekendEastbound: '26',
  weekendWestbound: '28',
};

function parseScheduleHTML(html: string, stopName: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tr.stop-schedule'));

  console.log(`\n🔍 Parsing for stop: "${stopName}"`);
  console.log(`   Found ${rows.length} rows with class "stop-schedule"`);

  if (rows.length > 0) {
    console.log('   Available stops:');
    rows.forEach((row, idx) => {
      const nameDiv = row.querySelector('.s-name');
      console.log(`     [${idx}] ${nameDiv?.textContent?.trim() || 'EMPTY'}`);
    });
  }

  const stopRow = rows.find(row => {
    const nameDiv = row.querySelector('.s-name');
    return nameDiv && nameDiv.textContent?.includes(stopName);
  });

  if (!stopRow) {
    console.warn(`   ❌ Stop "${stopName}" NOT FOUND`);
    return [];
  }

  const times: string[] = [];
  const timeCells = stopRow.querySelectorAll('td .s-time span');
  timeCells.forEach(span => {
    const time = span.textContent?.trim();
    if (time && time !== '-') {
      times.push(time);
    }
  });

  console.log(`   ✅ Found ${times.length} times`);
  return times;
}

describe('Lakeland Bus Schedule - Integration Test', () => {
  it('should fetch and parse all 4 schedules correctly', async () => {
    console.log('\n🧪 INTEGRATION TEST: Fetching real schedules from Lakeland Bus API\n');
    console.log('━'.repeat(60));

    // Fetch all 4 schedules
    console.log('\n📡 Fetching schedules...');
    const [weekdayEastHTML, weekdayWestHTML, weekendEastHTML, weekendWestHTML] = await Promise.all([
      fetch(`${VERCEL_API_URL}?id=${SCHEDULE_IDS.weekdayEastbound}`).then(r => r.text()),
      fetch(`${VERCEL_API_URL}?id=${SCHEDULE_IDS.weekdayWestbound}`).then(r => r.text()),
      fetch(`${VERCEL_API_URL}?id=${SCHEDULE_IDS.weekendEastbound}`).then(r => r.text()),
      fetch(`${VERCEL_API_URL}?id=${SCHEDULE_IDS.weekendWestbound}`).then(r => r.text()),
    ]);

    console.log('✅ Fetched all HTML responses:');
    console.log(`   Weekday East: ${weekdayEastHTML.length} chars`);
    console.log(`   Weekday West: ${weekdayWestHTML.length} chars`);
    console.log(`   Weekend East: ${weekendEastHTML.length} chars`);
    console.log(`   Weekend West: ${weekendWestHTML.length} chars`);

    // Parse each schedule
    console.log('\n📋 Parsing schedules...');
    console.log('━'.repeat(60));

    console.log('\n1️⃣  WEEKDAY EASTBOUND (Waterview → PABT)');
    const weekdayEastbound = parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)');

    console.log('\n2️⃣  WEEKDAY WESTBOUND (PABT → Waterview)');
    const weekdayWestbound = parseScheduleHTML(weekdayWestHTML, 'NY PABT');

    console.log('\n3️⃣  WEEKEND EASTBOUND (Waterview → PABT)');
    const weekendEastbound = parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)');

    console.log('\n4️⃣  WEEKEND WESTBOUND (PABT → Waterview)');
    const weekendWestbound = parseScheduleHTML(weekendWestHTML, 'LEAVES FROM GATE');

    // Print results
    console.log('\n📊 FINAL RESULTS');
    console.log('━'.repeat(60));
    console.log(`Weekday Eastbound:  ${weekdayEastbound.length} times`);
    if (weekdayEastbound.length > 0) {
      console.log(`  → ${weekdayEastbound.slice(0, 5).join(', ')}${weekdayEastbound.length > 5 ? '...' : ''}`);
    }
    console.log(`Weekday Westbound:  ${weekdayWestbound.length} times`);
    if (weekdayWestbound.length > 0) {
      console.log(`  → ${weekdayWestbound.slice(0, 5).join(', ')}${weekdayWestbound.length > 5 ? '...' : ''}`);
    }
    console.log(`Weekend Eastbound:  ${weekendEastbound.length} times`);
    if (weekendEastbound.length > 0) {
      console.log(`  → ${weekendEastbound.join(', ')}`);
    }
    console.log(`Weekend Westbound:  ${weekendWestbound.length} times`);
    if (weekendWestbound.length > 0) {
      console.log(`  → ${weekendWestbound.join(', ')}`);
    }

    // Assertions
    console.log('\n🧪 Running assertions...');
    expect(weekdayEastbound.length, 'Weekday Eastbound should have times').toBeGreaterThan(0);
    expect(weekdayWestbound.length, 'Weekday Westbound should have times').toBeGreaterThan(0);
    expect(weekendEastbound.length, 'Weekend Eastbound should have times').toBeGreaterThan(0);
    expect(weekendWestbound.length, 'Weekend Westbound should have times').toBeGreaterThan(0);

    console.log('✅ All assertions passed!\n');
    console.log('━'.repeat(60));
  }, 60000); // 60 second timeout
});
