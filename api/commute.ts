import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSchedule } from './services/lakelandBus.js';

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
    error?: string;
}

interface RouteOption {
    name: string;
    totalTime?: string;
    eta?: string;
    leaveInMins?: number | null;
    isBest?: boolean;
    hasError?: boolean;
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
    office: { name: 'Office', shortName: 'Office', address: '200 West St, New York, NY 10282' },
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
            name: 'Drive Direct',
            segments: [
                { type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' },
            ],
        },
        {
            name: 'Via Harrison PATH',
            segments: [
                { type: 'drive', from: 'home', to: 'harrisonParking', fromLabel: 'Home', toLabel: 'Harrison Parking' },
                { type: 'walk', fromLabel: 'Harrison Parking', toLabel: 'Harrison PATH', duration: '5m' },
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
            name: 'Drive Direct',
            segments: [
                { type: 'drive', from: 'office', to: 'home', fromLabel: 'Office', toLabel: 'Home' },
            ],
        },
        {
            name: 'Via Harrison PATH',
            segments: [
                { type: 'walk', fromLabel: 'Office', toLabel: 'WTC PATH', duration: '5m' },
                { type: 'transit', from: 'wtcPath', to: 'harrisonPath', fromLabel: 'WTC PATH', toLabel: 'Harrison', mode: 'path' },
                { type: 'walk', fromLabel: 'Harrison PATH', toLabel: 'Harrison Parking', duration: '5m' },
                { type: 'drive', from: 'harrisonParking', to: 'home', fromLabel: 'Harrison Parking', toLabel: 'Home' },
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
        routeModifiers: { avoidFerries: true },
        languageCode: 'en-US',
        units: 'IMPERIAL',
    };

    try {
        const response = await fetch(ROUTES_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                'Referer': 'https://commutejs.vercel.app/',
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
        computeAlternativeRoutes: true,
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
                'Referer': 'https://commutejs.vercel.app/',
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.staticDuration,routes.legs.steps.transitDetails',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) return null;

        // Sort routes by arrival time (earliest arrival first)
        const sortedRoutes = data.routes.sort((a: any, b: any) => {
            const aArrival = new Date(a.legs?.[0]?.steps?.[a.legs[0].steps.length - 1]?.transitDetails?.stopDetails?.arrivalTime || 0).getTime();
            const bArrival = new Date(b.legs?.[0]?.steps?.[b.legs[0].steps.length - 1]?.transitDetails?.stopDetails?.arrivalTime || 0).getTime();

            // If arrival times are missing or equal, fall back to duration
            if (aArrival !== bArrival) return aArrival - bArrival;

            const aDuration = parseInt(a.duration.replace('s', ''));
            const bDuration = parseInt(b.duration.replace('s', ''));
            return aDuration - bDuration;
        });

        const route = sortedRoutes[0];
        const leg = route.legs?.[0];
        const durationSeconds = parseInt(route.duration.replace('s', ''));
        const delayMinutes = Math.round((durationSeconds - (leg?.staticDuration ? parseInt(leg.staticDuration.replace('s', '')) : durationSeconds)) / 60);

        const hasPath = leg?.steps?.some((step: any) =>
            step.transitDetails?.transitLine?.nameShort === 'PATH' || step.transitDetails?.transitLine?.name?.includes('PATH')
        );

        let departureTimeStr, arrivalTimeStr;
        let departureDate, arrivalDate;
        const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
        if (transitSteps && transitSteps.length > 0) {
            const first = transitSteps[0].transitDetails?.stopDetails?.departureTime;
            const last = transitSteps[transitSteps.length - 1].transitDetails?.stopDetails?.arrivalTime;
            if (first) {
                departureDate = new Date(first);
                departureTimeStr = formatTimeToAMPM(departureDate);
            }
            if (last) {
                arrivalDate = new Date(last);
                arrivalTimeStr = formatTimeToAMPM(arrivalDate);
            }
        }

        return {
            from: origin,
            to: destination,
            duration: formatDuration(Math.round(durationSeconds / 60)),
            distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
            traffic: delayMinutes > 2 ? `Delays (+${delayMinutes} min)` : 'On time',
            // Return ISO 8601 UTC strings for frontend to format
            departureTime: departureDate?.toISOString(),
            arrivalTime: arrivalDate?.toISOString(),
            // @ts-ignore - internal use
            departureDate,
            // @ts-ignore - internal use
            arrivalDate
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
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [month, day, year] = nyStr.split('/');

    // Create a date as if it were local time (UTC on Vercel)
    const date = new Date(`${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);

    // Adjust for the difference between "local" and "America/New_York"
    const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const diff = date.getTime() - nyDate.getTime();
    return new Date(date.getTime() + diff);
}

function calculateArrivalTime(departureTime: string, duration: string): string | null {
    const depDate = parseTimeToDate(departureTime);
    if (!depDate) return null;
    return formatTimeToAMPM(new Date(depDate.getTime() + parseDurationToMinutes(duration) * 60000));
}

function formatTimeToAMPM(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
    }).replace(/^0/, '');
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

/**
 * Find the next bus departure after arrivalTimeUTC
 * Schedule times are stored as "HH:MM" (24-hour) in NY timezone
 * Returns ISO 8601 UTC string
 */
async function findNextBus(arrivalTimeUTC: Date, direction: 'eastbound' | 'westbound'): Promise<{ departureTime: string } | null> {
    const schedule = await getSchedule();

    // Determine day type based on NY time
    const nyDayStr = arrivalTimeUTC.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short'
    });
    const isWeekend = nyDayStr === 'Sat' || nyDayStr === 'Sun';
    const type = isWeekend ? 'weekend' : 'weekday';

    const times = schedule.schedules[type][direction];
    if (!times || times.length === 0) return null;

    // Find the first bus that departs after arrivalTimeUTC
    for (const timeStr of times) {
        const busTimeUTC = scheduleTimeToUTC(timeStr);
        if (busTimeUTC >= arrivalTimeUTC) {
            return { departureTime: busTimeUTC.toISOString() };
        }
    }

    return null;
}

// ============ PARALLEL ROUTE PROCESSING ============

/**
 * Pre-fetch all drive segment data in parallel
 * Returns a Map of segment index -> fetched data (or null if failed)
 */
async function prefetchDriveSegments(
    segments: SegmentConfig[]
): Promise<Map<number, Partial<CommuteSegment> | null>> {
    const driveSegments = segments
        .map((seg, idx) => ({ seg, idx }))
        .filter(({ seg }) => seg.type === 'drive');

    const results = await Promise.all(
        driveSegments.map(async ({ seg, idx }) => {
            if (seg.type === 'drive') {
                const result = await fetchDrivingDirections(
                    LOCATIONS[seg.from].address,
                    LOCATIONS[seg.to].address
                );
                return { idx, result };
            }
            return { idx, result: null };
        })
    );

    const prefetchedData = new Map<number, Partial<CommuteSegment> | null>();
    for (const { idx, result } of results) {
        prefetchedData.set(idx, result);
    }

    return prefetchedData;
}

/**
 * Process a single route configuration and return a RouteOption
 * Uses pre-fetched drive data when available to avoid redundant API calls
 */
async function processRoute(routeConfig: RouteConfig): Promise<RouteOption> {
    // Pre-fetch all drive segments in parallel
    const prefetchedDriveData = await prefetchDriveSegments(routeConfig.segments);

    // === PASS 1: Collect all segments with durations (times not yet set) ===
    interface SegmentData {
        segment: Omit<CommuteSegment, 'departureTime' | 'arrivalTime'> & {
            departureTime?: string;
            arrivalTime?: string;
            error?: string;
            departureDate?: Date;
            arrivalDate?: Date;
        };
        fixedDepartureTime?: Date;
        hasError?: boolean;
    }
    const segmentData: SegmentData[] = [];
    let currentCommuteTime = new Date();
    let routeHasError = false;

    for (let segIdx = 0; segIdx < routeConfig.segments.length; segIdx++) {
        const segConfig = routeConfig.segments[segIdx];
        let segment: (Partial<CommuteSegment> & { departureDate?: Date; arrivalDate?: Date }) | null = null;
        let fixedDepartureTime: Date | undefined;
        let segmentHasError = false;

        if (segConfig.type === 'drive') {
            // Use pre-fetched data instead of making another API call
            const driveRes = prefetchedDriveData.get(segIdx);
            if (driveRes) {
                segment = { ...driveRes, mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel };
            } else {
                segment = { mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'Google API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        } else if (segConfig.type === 'walk') {
            segment = { mode: 'walk', from: segConfig.fromLabel, to: segConfig.toLabel, duration: segConfig.duration, distance: '-', traffic: 'Walk' };
        } else if (segConfig.type === 'transit') {
            const transitRes = await fetchTransitDirections(
                LOCATIONS[segConfig.from].address,
                LOCATIONS[segConfig.to].address,
                currentCommuteTime
            );
            if (transitRes) {
                segment = { ...transitRes, mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel };
                if (transitRes.departureTime) {
                    fixedDepartureTime = parseTimeToDate(transitRes.departureTime) || undefined;
                }
            } else {
                segment = { mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'Google API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        } else if (segConfig.type === 'bus') {
            const nextBus = await findNextBus(currentCommuteTime, segConfig.direction);
            if (nextBus) {
                // Use pre-fetched drive data for bus route duration estimate
                const driveRes = prefetchedDriveData.get(segIdx) ||
                    await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                const busDuration = driveRes?.duration || '45m';
                const busDepDate = new Date(nextBus.departureTime);
                const busDepDisplay = formatTimeToAMPM(busDepDate);
                const busArrDate = new Date(busDepDate.getTime() + parseDurationToMinutes(busDuration) * 60000);
                segment = {
                    mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: busDuration,
                    distance: driveRes?.distance || '30 mi', traffic: `Departs ${busDepDisplay}`,
                    departureTime: busDepDate.toISOString(), arrivalTime: busArrDate.toISOString()
                };
                fixedDepartureTime = busDepDate;
            } else {
                segment = { mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'Lakeland API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        }

        if (segment) {
            segmentData.push({ segment: segment as CommuteSegment, fixedDepartureTime, hasError: segmentHasError });
            if (!segmentHasError && segment.duration && segment.duration !== '-') {
                if (segment.arrivalDate) {
                    currentCommuteTime = segment.arrivalDate;
                } else if (fixedDepartureTime) {
                    const durationMins = parseDurationToMinutes(segment.duration);
                    currentCommuteTime = new Date(fixedDepartureTime.getTime() + durationMins * 60000);
                } else {
                    const durationMins = parseDurationToMinutes(segment.duration);
                    currentCommuteTime = new Date(currentCommuteTime.getTime() + durationMins * 60000);
                }
            }
        }
    }

    if (segmentData.length === 0) {
        return { name: routeConfig.name, segments: [], hasError: true, isBest: false };
    }

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

    let idealStartTime: Date;
    if (firstFixedTransitTime && firstFixedTransitIndex > 0) {
        let timeToReachTransit = 0;
        for (let i = 0; i < firstFixedTransitIndex; i++) {
            timeToReachTransit += parseDurationToMinutes(segmentData[i].segment.duration);
        }
        idealStartTime = new Date(firstFixedTransitTime.getTime() - timeToReachTransit * 60000);
    } else {
        idealStartTime = new Date();
    }

    // === PASS 3: Assign times to all segments starting from idealStartTime ===
    const segments: CommuteSegment[] = [];
    let currentTime = idealStartTime;

    for (let i = 0; i < segmentData.length; i++) {
        const sd = segmentData[i];
        const segment = { ...sd.segment } as CommuteSegment;

        if (sd.hasError) {
            delete segment.departureTime;
            delete segment.arrivalTime;
            segments.push(segment);
            continue;
        }

        if (sd.fixedDepartureTime && sd.fixedDepartureTime > currentTime) {
            currentTime = sd.fixedDepartureTime;
        }

        segment.departureTime = currentTime.toISOString();
        const durationMins = parseDurationToMinutes(segment.duration);
        const arrivalDate = new Date(currentTime.getTime() + durationMins * 60000);
        segment.arrivalTime = arrivalDate.toISOString();
        currentTime = arrivalDate;

        segments.push(segment);
    }

    if (routeHasError) {
        return { name: routeConfig.name, segments, hasError: true, isBest: false };
    }

    let totalMinutes = 0;
    if (segments[0].departureTime && segments[segments.length - 1].arrivalTime) {
        const startTime = new Date(segments[0].departureTime);
        const endTime = new Date(segments[segments.length - 1].arrivalTime);
        totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        if (totalMinutes < 0) totalMinutes += 1440;
    }

    return {
        name: routeConfig.name,
        segments,
        totalTime: formatDuration(totalMinutes),
        eta: segments[segments.length - 1].arrivalTime || 'Unknown',
        isBest: false
    };
}

/**
 * Process all routes in parallel using Promise.all
 */
async function processAllRoutesInParallel(routeConfigs: RouteConfig[]): Promise<RouteOption[]> {
    const routes = await Promise.all(
        routeConfigs.map(config => processRoute(config))
    );

    // Sort routes: valid routes by duration, error routes at end
    routes.sort((a, b) => {
        if (a.hasError && !b.hasError) return 1;
        if (!a.hasError && b.hasError) return -1;
        if (a.hasError && b.hasError) return 0;
        return parseDurationToMinutes(a.totalTime || '0m') - parseDurationToMinutes(b.totalTime || '0m');
    });

    // Mark best route (first non-error route)
    if (routes.length > 0 && !routes[0].hasError) {
        routes[0].isBest = true;
    }

    return routes;
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { direction } = req.query;

    if (direction !== 'toOffice' && direction !== 'toHome') {
        return res.status(400).json({ error: 'Invalid direction. Use toOffice or toHome.' });
    }

    try {
        const routesConfig = ROUTES_CONFIG[direction];

        // Process all routes in parallel for better performance
        const routes = await processAllRoutesInParallel(routesConfig);

        const response: CommuteResponse = {
            direction: direction as 'toOffice' | 'toHome',
            lastUpdated: new Date().toISOString(),
            routes
        };
        res.status(200).json(response);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to calculate commute' });
    }
}
