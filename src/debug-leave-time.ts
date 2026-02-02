/**
 * Debug script to trace through the "Leave: X mins" calculation
 * Run with: npx ts-node src/debug-leave-time.ts
 */

// Simulate the same helper functions from App.tsx
function parseDurationToMinutes(duration: string): number {
  const hoursMatch = duration.match(/(\d+)h/);
  const minutesMatch = duration.match(/(\d+)m/);

  let totalMinutes = 0;
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }
  return totalMinutes;
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

function formatTimeToAMPM(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  }).replace(/^0/, '');
}

// Eastbound bus schedule (weekday) - now in 24-hour HH:MM format
const eastboundSchedule = [
  "04:50", "05:20", "05:50", "06:20", "06:50",
  "07:20", "07:50", "08:20", "08:50", "09:20",
  "10:20", "11:20", "12:20", "13:20", "14:20",
  "15:20", "16:20", "17:20", "18:20", "19:20",
  "20:20", "21:20"
];

// Simulate finding next bus - returns ISO 8601 UTC string
function findNextBus(arrivalTime: Date, schedule: string[]): { departureTime: string } | null {
  for (const timeStr of schedule) {
    const busTimeUTC = scheduleTimeToUTC(timeStr);
    if (busTimeUTC >= arrivalTime) {
      return {
        departureTime: busTimeUTC.toISOString(),
      };
    }
  }
  return null;
}

// ========== SIMULATION ==========
console.log('='.repeat(60));
console.log('DEBUG: "Via Port Authority Bus" Leave Time Calculation');
console.log('='.repeat(60));

// Current time - TEST DIFFERENT TIMES
const NOW = new Date();
// Test specific times - uncomment one:
NOW.setHours(9, 25, 0, 0);  // 9:25 AM - just after 9:20 bus, next is 10:20
// NOW.setHours(14, 0, 0, 0); // 2:00 PM
// NOW.setHours(16, 26, 0, 0); // 4:26 PM

console.log(`\n📍 CURRENT TIME: ${NOW.toLocaleTimeString()}`);

// Show what times would give ~101 mins
console.log('\n📊 Bus schedule (eastbound, 24h format): ' + eastboundSchedule.join(', '));

// Simulate Route 4 segments for toOffice
// These would come from Google Maps API in real app
// TEST: Try different drive times to see effect on Leave time
const driveToWaterviewDuration = '8m';  // Short drive - produces 101m?
const walkToBusStopDuration = '3m';

console.log('\n📋 STEP 1: Build segments before bus');
console.log(`   [0] Drive: Home → Waterview P&R: ${driveToWaterviewDuration}`);
console.log(`   [1] Walk: Waterview P&R → Bus Stop: ${walkToBusStopDuration}`);

// Calculate arrival time at bus stop
const priorMinutes = parseDurationToMinutes(driveToWaterviewDuration) + parseDurationToMinutes(walkToBusStopDuration);
console.log(`\n📋 STEP 2: Calculate arrival at bus stop`);
console.log(`   Prior segments duration: ${driveToWaterviewDuration} + ${walkToBusStopDuration} = ${priorMinutes} mins`);

const arrivalAtBusStop = new Date(NOW.getTime() + priorMinutes * 60000);
console.log(`   Arrival at bus stop: ${NOW.toLocaleTimeString()} + ${priorMinutes}m = ${arrivalAtBusStop.toLocaleTimeString()}`);

// Find next bus
console.log('\n📋 STEP 3: Find next bus after arrival');
const nextBus = findNextBus(arrivalAtBusStop, eastboundSchedule);
if (nextBus) {
  const busDepartureDate = new Date(nextBus.departureTime);
  const busDisplayTime = formatTimeToAMPM(busDepartureDate);
  const waitMinutes = Math.round((busDepartureDate.getTime() - arrivalAtBusStop.getTime()) / 60000);
  console.log(`   Next bus departs: ${busDisplayTime} (ISO: ${nextBus.departureTime})`);
  console.log(`   Wait time at stop: ${waitMinutes} mins`);

  // Now simulate calculateLeaveInMins
  console.log('\n📋 STEP 4: calculateLeaveInMins calculation');
  console.log('   This function works BACKWARDS from bus departure time');

  console.log(`\n   Transit (bus) departure: ${busDisplayTime}`);

  // Prior segments before bus (index 0 and 1)
  const priorMinsBeforeBus = parseDurationToMinutes(driveToWaterviewDuration) + parseDurationToMinutes(walkToBusStopDuration);
  console.log(`   Prior segments total: ${priorMinsBeforeBus} mins`);

  // Commute start time = bus departure - prior duration
  const commuteStartTime = new Date(busDepartureDate.getTime() - priorMinsBeforeBus * 60000);
  console.log(`   Commute start time: ${busDisplayTime} - ${priorMinsBeforeBus}m = ${commuteStartTime.toLocaleTimeString()}`);

  // Buffer
  const buffer = 2; // Not Harrison route
  console.log(`   Buffer: ${buffer} mins (non-Harrison route)`);

  // Leave in mins
  const leaveInMins = Math.round((commuteStartTime.getTime() - NOW.getTime()) / 60000) - buffer;
  console.log(`\n   FINAL CALCULATION:`);
  console.log(`   Leave in mins = (${commuteStartTime.toLocaleTimeString()} - ${NOW.toLocaleTimeString()}) - ${buffer}`);
  console.log(`                 = ${Math.round((commuteStartTime.getTime() - NOW.getTime()) / 60000)} - ${buffer}`);
  console.log(`                 = ${leaveInMins} mins`);

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 RESULT: Leave: ${leaveInMins}m`);
  console.log('='.repeat(60));

  // Show the issue
  console.log('\n⚠️  ANALYSIS:');
  if (leaveInMins > 60) {
    console.log(`   The next bus at ${busDisplayTime} is ${waitMinutes} mins after you arrive at the stop.`);
    console.log(`   This means you'd be waiting ${waitMinutes} mins at the bus stop.`);
    console.log(`   The "Leave" time is working correctly - it tells you when to leave home.`);
    console.log(`\n   If this seems wrong, the issue might be:`);
    console.log(`   1. Bus schedule gaps - buses run infrequently at this hour`);
    console.log(`   2. Or you expected "Leave" to mean something else`);
  }
} else {
  console.log('   ❌ No bus found!');
  process.exit(1);
}
