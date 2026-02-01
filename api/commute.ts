import type { VercelRequest, VercelResponse } from '@vercel/node';
import { JSDOM } from 'jsdom';

// ============ TYPES ============
interface CommuteSegment {
    mode: 'drive' | 'walk' | 'train' | 'path' | 'bus';
    from: string;
    to: string;
    fromLabel?: string;
    toLabel?: string;
    duration: string;
    distance?: string;
    traffic?: string;
    departureTime?: string;
    arrivalTime?: string;
}

interface RouteOption {
    name: string;
    totalTime: string;
    eta: string;
    leaveInMins?: number | null;
    isBest?: boolean;
    segments: CommuteSegment[];
}

interface CommuteResponse {
    direction: 'toOffice' | 'toHome';
    lastUpdated: string;
    routes: RouteOption[];
}

// ============ LOCATIONS ============
const LOCATIONS: Record<string, { name: string; shortName: string; address: string }> = {
    home: { name: 'Home', shortName: 'Home', address: '411 Mountainway, Morris Plains, NJ' },
    harrisonParking: { name: 'Harrison Parking', shortName: 'Harrison P', address: 'Guyon St Parking Lot, Harrison, NJ' },
    harrisonPath: { name: 'Harrison PATH', shortName: 'Harrison', address: 'Harrison PATH Station, Harrison, NJ' },
    morrisPlainsStation: { name: 'Morris Plains Station', shortName: 'Morris Plains', address: 'Morris Plains Station, Morris Plains, NJ' },
    hobokenStation: { name: 'Hoboken Terminal', shortName: 'Hoboken', address: 'Hoboken Terminal, Hoboken, NJ' },
    nyPennStation: { name: 'NY Penn Station', shortName: 'Penn Station', address: 'Pennsylvania Station, New York, NY' },
    waterviewParkRide: { name: 'Waterview Blvd Park & Ride', shortName: 'Waterview P&R', address: 'Waterview Blvd Park and Ride, Parsippany, NJ' },
    portAuthority: { name: 'Port Authority Bus Terminal', shortName: 'Port Authority', address: '625 8th Ave, New York, NY' },
    wtcPath: { name: 'WTC PATH', shortName: 'WTC PATH', address: 'World Trade Center PATH Station, New York, NY' },
    office: { name: 'Office', shortName: 'Office', address: '200 West St, New York, NY' },
};

// ============ ROUTES CONFIG ============
type SegmentConfig =
    | { type: 'drive'; from: string; to: string; fromLabel: string; toLabel: string }
    | { type: 'walk'; fromLabel: string; toLabel: string; duration: string }
    | { type: 'transit'; from: string; to: string; fromLabel: string; toLabel: string; mode: 'train' | 'path' }
    | { type: 'bus'; direction: 'eastbound' | 'westbound'; from: string; to: string; fromLabel: string; toLabel: string };

type RouteConfig = { name: string; segments: SegmentConfig[] };

const ROUTES_CONFIG: { toOffice: RouteConfig[]; toHome: RouteConfig[] } = {
    toOffice: [
        {
            name: 'Via Harrison PATH',
            segments: [
                { type: 'drive', from: 'home', to: 'harrisonParking', fromLabel: 'Home', toLabel: 'Harrison P' },
                { type: 'walk', fromLabel: 'Harrison P', toLabel: 'Harrison PATH', duration: '5m' },
                { type: 'transit', from: 'harrisonPath', to: 'wtcPath', fromLabel: 'Harrison', toLabel: 'WTC PATH', mode: 'path' },
                { type: 'walk', fromLabel: 'WTC PATH', toLabel: 'Office', duration: '5m' },
            ],
        },
        {
            name: 'Via Hoboken Station',
            segments: [
                { type: 'drive', from: 'home', to: 'morrisPlainsStation', fromLabel: 'Home', toLabel: 'Morris Plains' },
                { type: 'walk', fromLabel: 'Morris Plains', toLabel: 'Parking', duration: '3m' },
                { type: 'transit', from: 'morrisPlainsStation', to: 'hobokenStation', fromLabel: 'Morris Plains', toLabel: 'Hoboken', mode: 'train' },
                { type: 'transit', from: 'hobokenStation', to: 'office', fromLabel: 'Hoboken', toLabel: 'Office', mode: 'path' },
            ],
        },
        {
            name: 'Via NY Penn Station',
            segments: [
                { type: 'drive', from: 'home', to: 'morrisPlainsStation', fromLabel: 'Home', toLabel: 'Morris Plains' },
                { type: 'walk', fromLabel: 'Morris Plains', toLabel: 'Parking', duration: '3m' },
                { type: 'transit', from: 'morrisPlainsStation', to: 'nyPennStation', fromLabel: 'Morris Plains', toLabel: 'Penn Station', mode: 'train' },
                { type: 'transit', from: 'nyPennStation', to: 'office', fromLabel: 'Penn Station', toLabel: 'Office', mode: 'train' },
            ],
        },
        {
            name: 'Via Port Authority Bus',
            segments: [
                { type: 'drive', from: 'home', to: 'waterviewParkRide', fromLabel: 'Home', toLabel: 'Waterview P&R' },
                { type: 'walk', fromLabel: 'Waterview P&R', toLabel: 'Bus Stop', duration: '3m' },
                { type: 'bus', direction: 'eastbound', from: 'waterviewParkRide', to: 'portAuthority', fromLabel: 'Waterview P&R', toLabel: 'Port Authority' },
                { type: 'transit', from: 'portAuthority', to: 'office', fromLabel: 'Port Authority', toLabel: 'Office', mode: 'train' },
            ],
        },
    ],
    toHome: [
        {
            name: 'Via Harrison PATH',
            segments: [
                { type: 'walk', fromLabel: 'Office', toLabel: 'WTC PATH', duration: '5m' },
                { type: 'transit', from: 'wtcPath', to: 'harrisonPath', fromLabel: 'WTC PATH', toLabel: 'Harrison', mode: 'path' },
                { type: 'walk', fromLabel: 'Harrison PATH', toLabel: 'Harrison P', duration: '5m' },
                { type: 'drive', from: 'harrisonParking', to: 'home', fromLabel: 'Harrison P', toLabel: 'Home' },
            ],
        },
        {
            name: 'Via Hoboken Station',
            segments: [
                { type: 'transit', from: 'office', to: 'hobokenStation', fromLabel: 'Office', toLabel: 'Hoboken', mode: 'path' },
                { type: 'transit', from: 'hobokenStation', to: 'morrisPlainsStation', fromLabel: 'Hoboken', toLabel: 'Morris Plains', mode: 'train' },
                { type: 'walk', fromLabel: 'Parking', toLabel: 'Morris Plains', duration: '3m' },
                { type: 'drive', from: 'morrisPlainsStation', to: 'home', fromLabel: 'Morris Plains', toLabel: 'Home' },
            ],
        },
        {
            name: 'Via NY Penn Station',
            segments: [
                { type: 'transit', from: 'office', to: 'nyPennStation', fromLabel: 'Office', toLabel: 'Penn Station', mode: 'train' },
                { type: 'transit', from: 'nyPennStation', to: 'morrisPlainsStation', fromLabel: 'NY Penn', toLabel: 'Morris Plains', mode: 'train' },
                { type: 'walk', fromLabel: 'Parking', toLabel: 'Morris Plains', duration: '3m' },
                { type: 'drive', from: 'morrisPlainsStation', to: 'home', fromLabel: 'Morris Plains', toLabel: 'Home' },
            ],
        },
        {
            name: 'Via Port Authority Bus',
            segments: [
                { type: 'transit', from: 'office', to: 'portAuthority', fromLabel: 'Office', toLabel: 'Port Authority', mode: 'train' },
                { type: 'bus', direction: 'westbound', from: 'portAuthority', to: 'waterviewParkRide', fromLabel: 'Port Authority', toLabel: 'Waterview P&R' },
                { type: 'walk', fromLabel: 'Bus Stop', toLabel: 'Waterview P&R', duration: '3m' },
                { type: 'drive', from: 'waterviewParkRide', to: 'home', fromLabel: 'Waterview P&R', toLabel: 'Home' },
            ],
        },
    ],
};

// ============ GOOGLE MAPS SERVICE ============
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

async function fetchDrivingDirections(origin: string, destination: string): Promise<Partial<CommuteSegment> | null> {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing Google Maps API Key');

    const requestBody = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        languageCode: 'en-US',
        units: 'IMPERIAL',
    };

    try {
        const response = await fetch(ROUTES_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.staticDuration',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return null;

        const route = data.routes[0];
        const leg = route.legs?.[0];
        const durationSeconds = parseInt(route.duration.replace('s', ''));
        const staticDurationSeconds = leg?.staticDuration ? parseInt(leg.staticDuration.replace('s', '')) : durationSeconds;
        const distanceMiles = (route.distanceMeters * 0.000621371).toFixed(1);

        return {
            from: origin,
            to: destination,
            duration: formatDuration(Math.round(durationSeconds / 60)),
            distance: `${distanceMiles} mi`,
            traffic: getTrafficStatus(staticDurationSeconds, durationSeconds),
        };
    } catch (error) {
        console.error('Error fetching driving directions:', error);
        return null;
    }
}

async function fetchTransitDirections(origin: string, destination: string, departureTime?: Date): Promise<Partial<CommuteSegment> | null> {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing Google Maps API Key');

    const requestBody: any = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: false,
        transitPreferences: { allowedTravelModes: ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL'] },
        languageCode: 'en-US',
        units: 'IMPERIAL',
    };

    if (departureTime) requestBody.departureTime = departureTime.toISOString();

    try {
        const response = await fetch(ROUTES_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.staticDuration,routes.legs.steps.transitDetails',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return null;

        const route = data.routes[0];
        const leg = route.legs?.[0];
        const durationSeconds = parseInt(route.duration.replace('s', ''));
        const delayMinutes = Math.round((durationSeconds - (leg?.staticDuration ? parseInt(leg.staticDuration.replace('s', '')) : durationSeconds)) / 60);

        const hasPath = leg?.steps?.some((step: any) =>
            step.transitDetails?.transitLine?.nameShort === 'PATH' || step.transitDetails?.transitLine?.name?.includes('PATH')
        );

        let departureTimeStr, arrivalTimeStr;
        const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
        if (transitSteps && transitSteps.length > 0) {
            const first = transitSteps[0].transitDetails?.stopDetails?.departureTime;
            const last = transitSteps[transitSteps.length - 1].transitDetails?.stopDetails?.arrivalTime;
            if (first) departureTimeStr = new Date(first).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            if (last) arrivalTimeStr = new Date(last).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }

        return {
            from: origin,
            to: destination,
            duration: formatDuration(Math.round(durationSeconds / 60)),
            distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
            traffic: delayMinutes > 2 ? `Delays (+${delayMinutes} min)` : 'On time',
            departureTime: departureTimeStr,
            arrivalTime: arrivalTimeStr,
        };
    } catch (error) {
        console.error('Error fetching transit directions:', error);
        return null;
    }
}

function getTrafficStatus(staticDuration: number, actualDuration: number): string {
    const delayPercentage = ((actualDuration - staticDuration) / staticDuration) * 100;
    if (delayPercentage < 5) return 'Light traffic';
    else if (delayPercentage < 15) return 'Moderate traffic';
    else if (delayPercentage < 30) return 'Heavy traffic';
    return `Severe delays (+${Math.round((actualDuration - staticDuration) / 60)} min)`;
}

// ============ LAKELAND BUS SERVICE ============
interface BusSchedule { eastbound: string[]; westbound: string[]; }
interface CachedScheduleData { timestamp: number; schedules: { weekday: BusSchedule; weekend: BusSchedule } }

const SCHEDULE_IDS = { weekdayEastbound: '25', weekdayWestbound: '32', weekendEastbound: '26', weekendWestbound: '28' };
let serverCache: { data: CachedScheduleData | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000;

function parseScheduleHTML(html: string, stopName: string): string[] {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const rows = Array.from(doc.querySelectorAll('tr.stop-schedule'));
    const stopRow = rows.find((row: any) => row.querySelector('.s-name')?.textContent?.includes(stopName));
    if (!stopRow) return [];
    const times: string[] = [];
    (stopRow as any).querySelectorAll('td .s-time span').forEach((span: any) => {
        const time = span.textContent?.trim();
        if (time && time !== '-') times.push(time);
    });
    return times;
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

async function getSchedule(): Promise<CachedScheduleData> {
    const now = Date.now();
    if (serverCache.data && (now - serverCache.timestamp < CACHE_TTL)) return serverCache.data;

    const fetchHTML = async (id: string) => {
        const resp = await fetch(`https://www.lakelandbus.com/wp-admin/admin-ajax.php?action=schedule&id=${id}`, { headers: { 'User-Agent': 'CommuteJS/1.0' } });
        return resp.text();
    };

    const [weekdayEastHTML, weekdayWestHTML, weekendEastHTML, weekendWestHTML] = await Promise.all([
        fetchHTML(SCHEDULE_IDS.weekdayEastbound), fetchHTML(SCHEDULE_IDS.weekdayWestbound),
        fetchHTML(SCHEDULE_IDS.weekendEastbound), fetchHTML(SCHEDULE_IDS.weekendWestbound),
    ]);

    const scheduleData: CachedScheduleData = {
        timestamp: now,
        schedules: {
            weekday: { eastbound: addAmPm(parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)'), 'eastbound', false), westbound: addAmPm(parseScheduleHTML(weekdayWestHTML, 'NY PABT'), 'westbound', false) },
            weekend: { eastbound: addAmPm(parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)'), 'eastbound', true), westbound: addAmPm(parseScheduleHTML(weekendWestHTML, 'Depart New York PABT'), 'westbound', true) },
        },
    };

    serverCache = { data: scheduleData, timestamp: now };
    return scheduleData;
}

// ============ HELPERS ============
function parseDurationToMinutes(duration: string): number {
    const h = duration.match(/(\d+)h/);
    const m = duration.match(/(\d+)m/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
}

function parseTimeToDate(timeStr: string): Date | null {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
}

function calculateArrivalTime(departureTime: string, duration: string): string | null {
    const depDate = parseTimeToDate(departureTime);
    if (!depDate) return null;
    return formatTimeToAMPM(new Date(depDate.getTime() + parseDurationToMinutes(duration) * 60000));
}

function formatTimeToAMPM(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/^0/, '');
}

function getDepartureTimeDate(segments: CommuteSegment[]): Date {
    const now = new Date();
    if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last.arrivalTime) {
            const parsed = parseTimeToDate(last.arrivalTime);
            if (parsed) return parsed;
        }
    }
    let total = 0;
    segments.forEach(s => { total += parseDurationToMinutes(s.duration); });
    return new Date(now.getTime() + total * 60000);
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function parseTimeMinutes(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    const ap = match[3].toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
}

async function findNextBus(arrivalTime: Date, direction: 'eastbound' | 'westbound'): Promise<{ departureTime: string; waitMinutes: number } | null> {
    const schedule = await getSchedule();
    const day = arrivalTime.getDay();
    const type = (day === 0 || day === 6) ? 'weekend' : 'weekday';
    const times = schedule.schedules[type][direction];
    if (!times) return null;

    const arrivalMinutes = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();
    for (const timeStr of times) {
        const busMinutes = parseTimeMinutes(timeStr);
        if (busMinutes >= arrivalMinutes) return { departureTime: timeStr, waitMinutes: busMinutes - arrivalMinutes };
    }
    return null;
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { direction } = req.query;

    if (direction !== 'toOffice' && direction !== 'toHome') {
        return res.status(400).json({ error: 'Invalid direction. Use toOffice or toHome.' });
    }

    try {
        const routesConfig = ROUTES_CONFIG[direction];
        const routes: RouteOption[] = [];

        for (const routeConfig of routesConfig) {
            let skipRoute = false;

            // === PASS 1: Collect all segments with durations (times not yet set) ===
            interface SegmentData {
                segment: Omit<CommuteSegment, 'departureTime' | 'arrivalTime'> & { departureTime?: string; arrivalTime?: string };
                fixedDepartureTime?: Date; // For transit/bus segments with schedules
            }
            const segmentData: SegmentData[] = [];
            let estimatedTimeFromStart = 0; // Running total of time from start

            for (const segConfig of routeConfig.segments) {
                if (skipRoute) break;
                let segment: Partial<CommuteSegment> | null = null;
                let fixedDepartureTime: Date | undefined;

                // Estimate arrival time at this segment (for transit lookups)
                const estimatedArrivalAtSegment = new Date(Date.now() + estimatedTimeFromStart * 60000);

                if (segConfig.type === 'drive') {
                    const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                    if (driveRes) {
                        segment = { ...driveRes, mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel };
                    }
                } else if (segConfig.type === 'walk') {
                    segment = { mode: 'walk', from: segConfig.fromLabel, to: segConfig.toLabel, duration: segConfig.duration, distance: '-', traffic: 'Walk' };
                } else if (segConfig.type === 'transit') {
                    const transitRes = await fetchTransitDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address, estimatedArrivalAtSegment);
                    if (transitRes) {
                        segment = { ...transitRes, mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel };
                        // Parse the fixed departure time from transit schedule
                        if (transitRes.departureTime) {
                            fixedDepartureTime = parseTimeToDate(transitRes.departureTime) || undefined;
                        }
                    }
                } else if (segConfig.type === 'bus') {
                    const nextBus = await findNextBus(estimatedArrivalAtSegment, segConfig.direction);
                    if (nextBus) {
                        const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                        const busDuration = driveRes?.duration || '45m';
                        segment = {
                            mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: busDuration,
                            distance: driveRes?.distance || '30 mi', traffic: `Departs ${nextBus.departureTime}`,
                            departureTime: nextBus.departureTime, arrivalTime: calculateArrivalTime(nextBus.departureTime, busDuration) || undefined
                        };
                        fixedDepartureTime = parseTimeToDate(nextBus.departureTime) || undefined;
                    } else {
                        skipRoute = true;
                    }
                }

                if (segment && segment.duration) {
                    segmentData.push({ segment: segment as CommuteSegment, fixedDepartureTime });
                    estimatedTimeFromStart += parseDurationToMinutes(segment.duration);
                }
            }

            if (skipRoute || segmentData.length === 0) continue;

            // === PASS 2: Find first fixed transit time and calculate backwards ===
            let firstFixedTransitIndex = -1;
            let firstFixedTransitTime: Date | null = null;

            for (let i = 0; i < segmentData.length; i++) {
                if (segmentData[i].fixedDepartureTime) {
                    firstFixedTransitIndex = i;
                    firstFixedTransitTime = segmentData[i].fixedDepartureTime!;
                    break;
                }
            }

            // Calculate the ideal start time by working backwards from the first transit
            let idealStartTime: Date;
            if (firstFixedTransitTime && firstFixedTransitIndex > 0) {
                // Sum up durations of all segments BEFORE the first transit
                let timeToReachTransit = 0;
                for (let i = 0; i < firstFixedTransitIndex; i++) {
                    timeToReachTransit += parseDurationToMinutes(segmentData[i].segment.duration);
                }
                // Start time = transit departure - time to reach it
                idealStartTime = new Date(firstFixedTransitTime.getTime() - timeToReachTransit * 60000);
            } else {
                // No fixed transit, just start now
                idealStartTime = new Date();
            }

            // === PASS 3: Assign times to all segments starting from idealStartTime ===
            const segments: CommuteSegment[] = [];
            let currentTime = idealStartTime;

            for (let i = 0; i < segmentData.length; i++) {
                const sd = segmentData[i];
                const segment = { ...sd.segment } as CommuteSegment;

                // Check if this segment has a fixed scheduled departure (transit/bus)
                if (sd.fixedDepartureTime && sd.fixedDepartureTime > currentTime) {
                    // There's a wait - the transit doesn't leave until the scheduled time
                    currentTime = sd.fixedDepartureTime;
                }

                // Set departure time
                segment.departureTime = formatTimeToAMPM(currentTime);

                // Calculate arrival time
                const durationMins = parseDurationToMinutes(segment.duration);
                const arrivalDate = new Date(currentTime.getTime() + durationMins * 60000);
                segment.arrivalTime = formatTimeToAMPM(arrivalDate);

                // Advance current time to arrival
                currentTime = arrivalDate;

                segments.push(segment);
            }

            if (segments.length > 0) {
                let totalMinutes = 0;
                if (segments[0].departureTime && segments[segments.length - 1].arrivalTime) {
                    totalMinutes = parseTimeMinutes(segments[segments.length - 1].arrivalTime!) - parseTimeMinutes(segments[0].departureTime);
                }
                routes.push({ name: routeConfig.name, segments, totalTime: formatDuration(totalMinutes), eta: segments[segments.length - 1].arrivalTime || 'Unknown', isBest: false });
            }
        }

        routes.sort((a, b) => parseDurationToMinutes(a.totalTime) - parseDurationToMinutes(b.totalTime));
        if (routes.length > 0) routes[0].isBest = true;

        const response: CommuteResponse = { direction: direction as 'toOffice' | 'toHome', lastUpdated: new Date().toISOString(), routes };
        res.status(200).json(response);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to calculate commute' });
    }
}
