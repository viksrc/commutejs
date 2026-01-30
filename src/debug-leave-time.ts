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

function parseTimeToDate(timeStr: string): Date | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return result;
}

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

// Eastbound bus schedule (weekday)
const eastboundSchedule = [
  "4:50 AM", "5:20 AM", "5:50 AM", "6:20 AM", "6:50 AM",
  "7:20 AM", "7:50 AM", "8:20 AM", "8:50 AM", "9:20 AM",
  "10:20 AM", "11:20 AM", "12:20 PM", "1:20 PM", "2:20 PM",
  "3:20 PM", "4:20 PM", "5:20 PM", "6:20 PM", "7:20 PM",
  "8:20 PM", "9:20 PM"
];

// Simulate finding next bus
function findNextBus(arrivalTime: Date, schedule: string[]): { departureTime: string; waitMinutes: number } | null {
  const arrivalMinutes = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();

  for (const busTime of schedule) {
    const busMinutes = timeToMinutes(busTime);
    if (busMinutes >= arrivalMinutes) {
      return {
        departureTime: busTime,
        waitMinutes: busMinutes - arrivalMinutes,
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
console.log('\n📊 Bus schedule (eastbound): ' + eastboundSchedule.join(', '));

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
  console.log(`   Next bus departs: ${nextBus.departureTime}`);
  console.log(`   Wait time at stop: ${nextBus.waitMinutes} mins`);
} else {
  console.log('   ❌ No bus found!');
  process.exit(1);
}

// Now simulate calculateLeaveInMins
console.log('\n📋 STEP 4: calculateLeaveInMins calculation');
console.log('   This function works BACKWARDS from bus departure time');

const busDepartureTime = parseTimeToDate(nextBus.departureTime);
console.log(`\n   Transit (bus) departure: ${nextBus.departureTime} → ${busDepartureTime?.toLocaleTimeString()}`);

// Prior segments before bus (index 0 and 1)
const priorMinsBeforeBus = parseDurationToMinutes(driveToWaterviewDuration) + parseDurationToMinutes(walkToBusStopDuration);
console.log(`   Prior segments total: ${priorMinsBeforeBus} mins`);

// Commute start time = bus departure - prior duration
const commuteStartTime = new Date(busDepartureTime!.getTime() - priorMinsBeforeBus * 60000);
console.log(`   Commute start time: ${busDepartureTime?.toLocaleTimeString()} - ${priorMinsBeforeBus}m = ${commuteStartTime.toLocaleTimeString()}`);

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
  console.log(`   The next bus at ${nextBus.departureTime} is ${nextBus.waitMinutes} mins after you arrive at the stop.`);
  console.log(`   This means you'd be waiting ${nextBus.waitMinutes} mins at the bus stop.`);
  console.log(`   The "Leave" time is working correctly - it tells you when to leave home.`);
  console.log(`\n   If this seems wrong, the issue might be:`);
  console.log(`   1. Bus schedule gaps - buses run infrequently at this hour`);
  console.log(`   2. Or you expected "Leave" to mean something else`);
}
