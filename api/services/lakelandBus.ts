
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

function addAmPm(times: string[], direction: 'eastbound' | 'westbound', isWeekend: boolean): string[] {
    return times.map(time => {
        const hour = parseInt(time.split(':')[0], 10);
        let isAM = false;
        if (direction === 'eastbound') isAM = isWeekend ? (hour >= 7 && hour < 12) : (hour >= 4 && hour <= 12);
        else isAM = isWeekend ? (hour === 9 || hour === 11) : (hour >= 7 && hour < 12);
        return `${time} ${isAM ? 'AM' : 'PM'}`;
    });
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

    const weekdayEastbound = addAmPm(parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)'), 'eastbound', false);
    const weekdayWestbound = addAmPm(parseScheduleHTML(weekdayWestHTML, 'NY PABT'), 'westbound', false);
    const weekendEastbound = addAmPm(parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)'), 'eastbound', true);
    const weekendWestbound = addAmPm(parseScheduleHTML(weekendWestHTML, 'Depart New York PABT'), 'westbound', true);

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
