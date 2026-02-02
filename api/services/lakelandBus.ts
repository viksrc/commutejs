
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
 * Convert 12-hour time (without AM/PM) to 24-hour "HH:MM" format
 * Uses schedule context to determine AM/PM
 */
function to24Hour(time: string, direction: 'eastbound' | 'westbound', isWeekend: boolean): string {
    const [hourStr, minute] = time.split(':');
    let hour = parseInt(hourStr, 10);

    // Determine if this hour is AM or PM based on schedule context
    // Schedule times are in 12-hour format without AM/PM markers
    let isAM: boolean;
    if (direction === 'eastbound') {
        // Eastbound: early morning departures (4-11 AM), then noon onwards
        isAM = isWeekend ? (hour >= 7 && hour <= 11) : (hour >= 4 && hour <= 11);
    } else {
        // Westbound: morning departures (7-11 AM), then afternoon/evening
        isAM = isWeekend ? (hour >= 9 && hour <= 11) : (hour >= 7 && hour <= 11);
    }

    // Convert to 24-hour format
    if (!isAM && hour !== 12) {
        hour += 12;
    }
    // hour 12 PM stays as 12 (noon)
    // No midnight (12 AM) buses in the schedule

    return `${hour.toString().padStart(2, '0')}:${minute}`;
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

    const weekdayEastbound = parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)').map(t => to24Hour(t, 'eastbound', false));
    const weekdayWestbound = parseScheduleHTML(weekdayWestHTML, 'NY PABT').map(t => to24Hour(t, 'westbound', false));
    const weekendEastbound = parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)').map(t => to24Hour(t, 'eastbound', true));
    const weekendWestbound = parseScheduleHTML(weekendWestHTML, 'Depart New York PABT').map(t => to24Hour(t, 'westbound', true));

    console.log(`[getSchedule] Parsed schedules - weekday eastbound: ${weekdayEastbound.length}, westbound: ${weekdayWestbound.length}`);
    console.log(`[getSchedule] Parsed schedules - weekend eastbound: ${weekendEastbound.length}, westbound: ${weekendWestbound.length}`);

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
