
export interface BusSchedule {
    eastbound: string[];
    westbound: string[];
}

export interface CachedScheduleData {
    timestamp: number;
    schedules: {
        weekday: BusSchedule;
        weekend: BusSchedule
    }
}

const SCHEDULE_IDS = {
    weekdayEastbound: '25',
    weekdayWestbound: '32',
    weekendEastbound: '26',
    weekendWestbound: '28'
};

let serverCache: { data: CachedScheduleData | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000;

function parseScheduleHTML(html: string, stopName: string): string[] {
    const rowRegex = /<tr[^>]*class="[^"]*stop-schedule[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
        const rowHtml = match[1];
        if (rowHtml.includes(stopName)) {
            const timeRegex = /<span[^>]*>(\d{1,2}:\d{2})<\/span>/g;
            const times: string[] = [];
            let timeMatch;

            while ((timeMatch = timeRegex.exec(rowHtml)) !== null) {
                const time = timeMatch[1].trim();
                if (time && time !== '-') {
                    times.push(time);
                }
            }
            return times;
        }
    }
    return [];
}

/**
 * Convert a list of 12-hour times (without AM/PM) to 24-hour "HH:MM" format.
 * Times must be in chronological order. We track when we cross noon to flip to PM.
 */
function convertTimesTo24Hour(times: string[], startHour: number): string[] {
    const result: string[] = [];
    let lastHour24 = startHour; // Track 24-hour value to detect wraparound

    for (const time of times) {
        const [hourStr, minute] = time.split(':');
        const hour12 = parseInt(hourStr, 10);

        // Determine 24-hour value based on chronological order
        let hour24: number;

        if (hour12 === 12) {
            // 12 is always noon (12:xx PM) in our schedules
            hour24 = 12;
        } else {
            // Check if this hour should be AM or PM based on last hour
            // If lastHour was >= 12 (PM), and current hour12 < last hour12, we're still in PM
            if (lastHour24 >= 12 && hour12 < 12) {
                // We're in PM territory
                hour24 = hour12 + 12;
            } else if (lastHour24 < 12 && hour12 < lastHour24 % 12) {
                // We've crossed from AM to PM (e.g., 11 -> 12 -> 1)
                hour24 = hour12 + 12;
            } else if (lastHour24 >= 12 && hour12 >= (lastHour24 % 12 || 12)) {
                // Continuing in PM
                hour24 = hour12 + 12;
            } else {
                // Still in AM
                hour24 = hour12;
            }
        }

        // Sanity check: hours should only increase (chronological order)
        // If hour24 would be less than lastHour24, we need to add 12
        if (hour24 < lastHour24) {
            hour24 += 12;
        }

        // Cap at 23 (no buses after midnight)
        if (hour24 > 23) {
            hour24 = hour24 % 24;
        }

        lastHour24 = hour24;
        result.push(`${hour24.toString().padStart(2, '0')}:${minute}`);
    }

    return result;
}

export async function getSchedule(): Promise<CachedScheduleData> {
    const now = Date.now();
    if (serverCache.data && (now - serverCache.timestamp < CACHE_TTL)) {
        console.log('[getSchedule] Returning cached schedule');
        return serverCache.data;
    }

    console.log('[getSchedule] Fetching fresh schedule from Lakeland...');

    const fetchHTML = async (id: string) => {
        const resp = await fetch(`https://www.lakelandbus.com/wp-admin/admin-ajax.php?action=schedule&id=${id}`, {
            headers: { 'User-Agent': 'CommuteJS/1.0' }
        });
        return resp.text();
    };

    const [weekdayEastHTML, weekdayWestHTML, weekendEastHTML, weekendWestHTML] = await Promise.all([
        fetchHTML(SCHEDULE_IDS.weekdayEastbound),
        fetchHTML(SCHEDULE_IDS.weekdayWestbound),
        fetchHTML(SCHEDULE_IDS.weekendEastbound),
        fetchHTML(SCHEDULE_IDS.weekendWestbound),
    ]);

    // Parse and convert times, using starting hour hint for each schedule
    // Eastbound starts early morning (4-5 AM), westbound starts later (7-9 AM)
    const weekdayEastbound = convertTimesTo24Hour(parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)'), 4);
    const weekdayWestbound = convertTimesTo24Hour(parseScheduleHTML(weekdayWestHTML, 'NY PABT'), 7);
    const weekendEastbound = convertTimesTo24Hour(parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)'), 7);
    const weekendWestbound = convertTimesTo24Hour(parseScheduleHTML(weekendWestHTML, 'Depart New York PABT'), 9);

    console.log(`[getSchedule] Parsed schedules - weekday eastbound: ${weekdayEastbound.length}, westbound: ${weekdayWestbound.length}`);
    console.log(`[getSchedule] Parsed schedules - weekend eastbound: ${weekendEastbound.length}, westbound: ${weekendWestbound.length}`);
    if (weekdayEastbound.length > 0) {
        console.log(`[getSchedule] weekday eastbound sample: ${weekdayEastbound.slice(0, 5).join(', ')} ... ${weekdayEastbound.slice(-3).join(', ')}`);
    }

    const scheduleData: CachedScheduleData = {
        timestamp: now,
        schedules: {
            weekday: {
                eastbound: weekdayEastbound,
                westbound: weekdayWestbound
            },
            weekend: {
                eastbound: weekendEastbound,
                westbound: weekendWestbound
            },
        },
    };

    serverCache = { data: scheduleData, timestamp: now };
    return scheduleData;
}
