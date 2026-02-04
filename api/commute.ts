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
    totalDurationSeconds?: number;
    startTime?: string;
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
    _version?: string;
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

type TransitResult = Partial<CommuteSegment> & { departureDate?: Date; arrivalDate?: Date };

async function fetchTransitDirections(origin: string, destination: string, departureTime?: Date, mode?: 'train' | 'path'): Promise<TransitResult | null> {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing Google Maps API Key');

    // Filter allowed transit modes based on segment mode
    // - 'train': NJ Transit, Amtrak, etc. - use TRAIN only
    // - 'path': PATH train - use SUBWAY/LIGHT_RAIL
    // - undefined: allow all
    let allowedModes: string[];
    if (mode === 'train') {
        allowedModes = ['TRAIN'];
    } else if (mode === 'path') {
        allowedModes = ['SUBWAY', 'LIGHT_RAIL'];
    } else {
        allowedModes = ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL'];
    }

    const requestBody: any = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: true,
        transitPreferences: { allowedTravelModes: allowedModes },
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

        let departureDate, arrivalDate;
        const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
        if (transitSteps && transitSteps.length > 0) {
            const first = transitSteps[0].transitDetails?.stopDetails?.departureTime;
            const last = transitSteps[transitSteps.length - 1].transitDetails?.stopDetails?.arrivalTime;
            if (first) {
                departureDate = new Date(first);
            }
            if (last) {
                arrivalDate = new Date(last);
            }
        }

        return {
            from: origin,
            to: destination,
            duration: formatDuration(Math.round(durationSeconds / 60)),
            distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
            traffic: delayMinutes > 2 ? `Delays (+${delayMinutes} min)` : 'On time',
            departureTime: departureDate?.toISOString(),
            arrivalTime: arrivalDate?.toISOString(),
            departureDate,
            arrivalDate
        };
    } catch (error) {
        console.error('Error fetching transit directions:', error);
        return null;
    }
}

/**
 * Fetch transit directions with ARRIVAL time constraint (for backward calculation)
 * Returns the latest departure that arrives by the specified time
 */
async function fetchTransitDirectionsWithArrival(origin: string, destination: string, arrivalTime: Date, mode?: 'train' | 'path'): Promise<TransitResult | null> {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing Google Maps API Key');

    // Filter allowed transit modes based on segment mode
    let allowedModes: string[];
    if (mode === 'train') {
        allowedModes = ['TRAIN'];
    } else if (mode === 'path') {
        allowedModes = ['SUBWAY', 'LIGHT_RAIL'];
    } else {
        allowedModes = ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL'];
    }

    const requestBody: any = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: true,
        transitPreferences: { allowedTravelModes: allowedModes },
        languageCode: 'en-US',
        units: 'IMPERIAL',
        arrivalTime: arrivalTime.toISOString(), // Key difference: arrival instead of departure
    };

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

        // Sort routes by departure time (latest departure first - we want to leave as late as possible)
        const sortedRoutes = data.routes.sort((a: any, b: any) => {
            const aDeparture = new Date(a.legs?.[0]?.steps?.find((s: any) => s.transitDetails)?.transitDetails?.stopDetails?.departureTime || 0).getTime();
            const bDeparture = new Date(b.legs?.[0]?.steps?.find((s: any) => s.transitDetails)?.transitDetails?.stopDetails?.departureTime || 0).getTime();
            return bDeparture - aDeparture; // Latest first
        });

        const route = sortedRoutes[0];
        const leg = route.legs?.[0];
        const durationSeconds = parseInt(route.duration.replace('s', ''));
        const delayMinutes = Math.round((durationSeconds - (leg?.staticDuration ? parseInt(leg.staticDuration.replace('s', '')) : durationSeconds)) / 60);

        const hasPath = leg?.steps?.some((step: any) =>
            step.transitDetails?.transitLine?.nameShort === 'PATH' || step.transitDetails?.transitLine?.name?.includes('PATH')
        );

        let departureDate, arrivalDate;
        const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
        if (transitSteps && transitSteps.length > 0) {
            const first = transitSteps[0].transitDetails?.stopDetails?.departureTime;
            const last = transitSteps[transitSteps.length - 1].transitDetails?.stopDetails?.arrivalTime;
            if (first) departureDate = new Date(first);
            if (last) arrivalDate = new Date(last);
        }

        return {
            from: origin,
            to: destination,
            duration: formatDuration(Math.round(durationSeconds / 60)),
            distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
            traffic: delayMinutes > 2 ? `Delays (+${delayMinutes} min)` : 'On time',
            departureTime: departureDate?.toISOString(),
            arrivalTime: arrivalDate?.toISOString(),
            departureDate,
            arrivalDate
        };
    } catch (error) {
        console.error('Error fetching transit directions with arrival:', error);
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

/**
 * Convert schedule time (HH:MM in NY timezone) to UTC Date for a specific date
 */
function scheduleTimeToUTCForDate(scheduleTime: string, nyDateStr: string): Date {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
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
 * If no bus is available today, returns tomorrow's first bus
 */
async function findNextBus(arrivalTimeUTC: Date, direction: 'eastbound' | 'westbound'): Promise<{ departureTime: string } | null> {
    const schedule = await getSchedule();

    // Helper to get day type and date string for a given date
    const getDayInfo = (date: Date) => {
        const dayStr = date.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
        const isWeekend = dayStr === 'Sat' || dayStr === 'Sun';
        return { type: isWeekend ? 'weekend' : 'weekday' as 'weekend' | 'weekday', dateStr };
    };

    // Try to find a bus today
    const today = getDayInfo(arrivalTimeUTC);
    const todayTimes = schedule.schedules[today.type][direction];

    if (todayTimes && todayTimes.length > 0) {
        for (const timeStr of todayTimes) {
            const busTimeUTC = scheduleTimeToUTCForDate(timeStr, today.dateStr);
            if (busTimeUTC >= arrivalTimeUTC) {
                return { departureTime: busTimeUTC.toISOString() };
            }
        }
    }

    // No bus today, find tomorrow's first bus
    const tomorrow = new Date(arrivalTimeUTC.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowInfo = getDayInfo(tomorrow);
    const tomorrowTimes = schedule.schedules[tomorrowInfo.type][direction];

    if (tomorrowTimes && tomorrowTimes.length > 0) {
        // Return the first bus tomorrow
        const firstBusTime = tomorrowTimes[0];
        const busTimeUTC = scheduleTimeToUTCForDate(firstBusTime, tomorrowInfo.dateStr);
        return { departureTime: busTimeUTC.toISOString() };
    }

    return null;
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { direction, asOf } = req.query;

    if (direction !== 'toOffice' && direction !== 'toHome') {
        return res.status(400).json({ error: 'Invalid direction. Use toOffice or toHome.' });
    }

    // Parse the requested departure time (asOf), default to now
    const requestedDepartureTime = asOf && typeof asOf === 'string' ? new Date(asOf) : new Date();

    try {
        const routesConfig = ROUTES_CONFIG[direction];

        const routePromises = routesConfig.map(async (routeConfig) => {
            let skipRoute = false;

            // === PASS 1: Collect all segments with durations (times not yet set) ===
            interface SegmentData {
                segment: Omit<CommuteSegment, 'departureTime' | 'arrivalTime'> & { departureTime?: string; arrivalTime?: string; error?: string; departureDate?: Date; arrivalDate?: Date };
                segConfig: SegmentConfig; // Store config for potential re-query in PASS 2
                fixedDepartureTime?: Date; // For transit/bus segments with schedules
                hasError?: boolean;
            }
            const segmentData: SegmentData[] = [];
            let currentCommuteTime = new Date(requestedDepartureTime); // Start from requested departure time
            let routeHasError = false;

            for (const segConfig of routeConfig.segments) {
                if (skipRoute) break;
                let segment: (Partial<CommuteSegment> & { departureDate?: Date; arrivalDate?: Date }) | null = null;
                let fixedDepartureTime: Date | undefined;
                let segmentHasError = false;

                if (segConfig.type === 'drive') {
                    const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
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
                    // Query Google with the arrival time at this point
                    const transitRes = await fetchTransitDirections(
                        LOCATIONS[segConfig.from].address,
                        LOCATIONS[segConfig.to].address,
                        currentCommuteTime,
                        segConfig.mode // Pass mode to filter transit types (train vs path)
                    );
                    if (transitRes) {
                        segment = { ...transitRes, mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel };
                        // Use the departure date directly (it's already a Date object)
                        if (transitRes.departureDate) {
                            fixedDepartureTime = transitRes.departureDate;
                        }
                    } else {
                        segment = { mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'Google API error' };
                        segmentHasError = true;
                        routeHasError = true;
                    }
                } else if (segConfig.type === 'bus') {
                    const nextBus = await findNextBus(currentCommuteTime, segConfig.direction);
                    if (nextBus) {
                        const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                        const busDuration = driveRes?.duration || '45m';
                        // nextBus.departureTime is now ISO 8601 UTC string
                        const busDepDate = new Date(nextBus.departureTime);
                        const busDepDisplay = formatTimeToAMPM(busDepDate);
                        const busArrDate = new Date(busDepDate.getTime() + parseDurationToMinutes(busDuration) * 60000);
                        segment = {
                            mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: busDuration,
                            distance: driveRes?.distance || '30 mi', traffic: `Departs ${busDepDisplay}`,
                            // Return ISO 8601 UTC strings
                            departureTime: busDepDate.toISOString(), arrivalTime: busArrDate.toISOString()
                        };
                        fixedDepartureTime = busDepDate;
                    } else {
                        segment = { mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'No bus schedule' };
                        segmentHasError = true;
                        routeHasError = true;
                    }
                }

                if (segment) {
                    segmentData.push({ segment: segment as CommuteSegment, segConfig, fixedDepartureTime, hasError: segmentHasError });
                    if (!segmentHasError && segment.duration && segment.duration !== '-') {
                        // Update absolute currentCommuteTime
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

            if (skipRoute || segmentData.length === 0) return null;

            // === PASS 2: Find LAST fixed transit and work backwards ===
            // This ensures we catch the right connections by re-querying earlier transits with arrival constraints
            let lastFixedTransitIndex = -1;
            let lastFixedTransitTime: Date | null = null;

            // Find the LAST fixed transit (work backwards through segments)
            for (let i = segmentData.length - 1; i >= 0; i--) {
                if (segmentData[i].fixedDepartureTime && !segmentData[i].hasError) {
                    lastFixedTransitIndex = i;
                    lastFixedTransitTime = segmentData[i].fixedDepartureTime!;
                    break;
                }
            }

            // Work backwards from the last fixed transit, re-querying earlier segments
            if (lastFixedTransitTime && lastFixedTransitIndex > 0) {
                let mustArriveBy = new Date(lastFixedTransitTime.getTime() - 5 * 60000); // 5 min buffer before transit

                // Process segments in reverse order, from (lastFixedTransitIndex - 1) down to 0
                for (let i = lastFixedTransitIndex - 1; i >= 0; i--) {
                    const sd = segmentData[i];
                    if (sd.hasError) continue;

                    if (sd.segConfig.type === 'walk') {
                        // Walk segment: just subtract duration
                        const walkMins = parseDurationToMinutes(sd.segment.duration);
                        mustArriveBy = new Date(mustArriveBy.getTime() - walkMins * 60000);
                    } else if (sd.segConfig.type === 'transit') {
                        // Transit segment: re-query with arrival time constraint
                        const transitConfig = sd.segConfig as { type: 'transit'; from: string; to: string; fromLabel: string; toLabel: string; mode: 'train' | 'path' };
                        const newTransitRes = await fetchTransitDirectionsWithArrival(
                            LOCATIONS[transitConfig.from].address,
                            LOCATIONS[transitConfig.to].address,
                            mustArriveBy,
                            transitConfig.mode // Pass mode to filter transit types
                        );

                        if (newTransitRes && newTransitRes.departureDate) {
                            // Update segment data with new transit times
                            sd.segment = { ...sd.segment, ...newTransitRes, mode: transitConfig.mode, from: transitConfig.fromLabel, to: transitConfig.toLabel };
                            sd.fixedDepartureTime = newTransitRes.departureDate;
                            // Next segment must arrive before this transit departs
                            mustArriveBy = new Date(newTransitRes.departureDate.getTime() - 5 * 60000);
                        }
                    } else if (sd.segConfig.type === 'drive') {
                        // Drive segment: subtract duration (Google doesn't support arrival time for driving with traffic well)
                        const driveMins = parseDurationToMinutes(sd.segment.duration);
                        mustArriveBy = new Date(mustArriveBy.getTime() - driveMins * 60000);
                    } else if (sd.segConfig.type === 'bus') {
                        // Bus segment: would need to re-query Lakeland, for now just subtract duration
                        const busMins = parseDurationToMinutes(sd.segment.duration);
                        mustArriveBy = new Date(busMins > 0 ? mustArriveBy.getTime() - busMins * 60000 : mustArriveBy.getTime());
                    }
                }
            }

            // Now find the FIRST fixed transit to calculate ideal start time
            let firstFixedTransitIndex = -1;
            let firstFixedTransitTime: Date | null = null;

            for (let i = 0; i < segmentData.length; i++) {
                if (segmentData[i].fixedDepartureTime && !segmentData[i].hasError) {
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
                // But never start before the requested departure time
                if (idealStartTime < requestedDepartureTime) {
                    idealStartTime = new Date(requestedDepartureTime);
                }
            } else {
                // No fixed transit before others, use requested departure time
                idealStartTime = new Date(requestedDepartureTime);
            }

            // === PASS 3: Assign times to all segments starting from idealStartTime ===
            const segments: CommuteSegment[] = [];
            let currentTime = idealStartTime;

            for (let i = 0; i < segmentData.length; i++) {
                const sd = segmentData[i];
                const segment = { ...sd.segment } as CommuteSegment;

                // Skip time assignment for error segments
                if (sd.hasError) {
                    delete segment.departureTime;
                    delete segment.arrivalTime;
                    segments.push(segment);
                    continue;
                }

                // Check if this segment has a fixed scheduled departure (transit/bus)
                if (sd.fixedDepartureTime && sd.fixedDepartureTime > currentTime) {
                    // There's a wait - the transit doesn't leave until the scheduled time
                    currentTime = sd.fixedDepartureTime;
                }

                // For transit/bus with actual times from Google, use those times
                // For drive/walk, calculate based on currentTime
                const hasFixedDep = !!sd.fixedDepartureTime;
                const hasDepDate = !!(sd.segment as any).departureDate;
                const hasArrDate = !!(sd.segment as any).arrivalDate;
                (segment as any)._debug = { hasFixedDep, hasDepDate, hasArrDate, segType: sd.segConfig.type };

                if (hasFixedDep && hasDepDate && hasArrDate) {
                    // Use actual times from Google
                    segment.departureTime = ((sd.segment as any).departureDate as Date).toISOString();
                    segment.arrivalTime = ((sd.segment as any).arrivalDate as Date).toISOString();
                    currentTime = (sd.segment as any).arrivalDate as Date;
                } else {
                    // Calculate times for drive/walk segments
                    segment.departureTime = currentTime.toISOString();
                    const durationMins = parseDurationToMinutes(segment.duration);
                    const arrivalDate = new Date(currentTime.getTime() + durationMins * 60000);
                    segment.arrivalTime = arrivalDate.toISOString();
                    currentTime = arrivalDate;
                }

                segments.push(segment);
            }

            // === PASS 4: Detect gaps before fixed transits and shift earlier segments later ===
            // This allows leaving later while still catching the same transit connections
            for (let i = 1; i < segments.length; i++) {
                const prevSegment = segments[i - 1];
                const currSegmentData = segmentData[i];

                if (!prevSegment.arrivalTime || !currSegmentData.fixedDepartureTime || currSegmentData.hasError) {
                    continue;
                }

                const prevArrival = new Date(prevSegment.arrivalTime);
                const transitDeparture = currSegmentData.fixedDepartureTime;
                const gapMs = transitDeparture.getTime() - prevArrival.getTime();
                const gapMins = gapMs / 60000;

                // If there's a significant gap (> 5 mins), shift all earlier segments later
                if (gapMins > 5) {
                    const shiftMs = gapMs - (5 * 60000); // Keep 5 min buffer

                    // But don't shift before the requested departure time
                    const firstSegmentDep = new Date(segments[0].departureTime!);
                    const newFirstDep = new Date(firstSegmentDep.getTime() + shiftMs);
                    if (newFirstDep < requestedDepartureTime) {
                        continue; // Can't shift, would be before requested time
                    }

                    // Shift all segments before the transit
                    for (let j = 0; j < i; j++) {
                        if (segments[j].departureTime) {
                            const oldDep = new Date(segments[j].departureTime!);
                            segments[j].departureTime = new Date(oldDep.getTime() + shiftMs).toISOString();
                        }
                        if (segments[j].arrivalTime) {
                            const oldArr = new Date(segments[j].arrivalTime!);
                            segments[j].arrivalTime = new Date(oldArr.getTime() + shiftMs).toISOString();
                        }
                    }
                }
            }

            if (segments.length > 0) {
                if (routeHasError) {
                    // Route has errors - don't show totalTime or eta
                    return { name: routeConfig.name, segments, hasError: true, isBest: false } as RouteOption;
                } else {
                    let totalSeconds = 0;
                    const routeStartTime = segments[0].departureTime;
                    const routeEta = segments[segments.length - 1].arrivalTime;
                    if (routeStartTime && routeEta) {
                        // Times are now ISO 8601, use Date objects for calculation
                        const startDate = new Date(routeStartTime);
                        const endDate = new Date(routeEta);
                        totalSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
                        if (totalSeconds < 0) totalSeconds += 86400; // Add 24 hours if negative
                    }
                    return {
                        name: routeConfig.name,
                        segments,
                        totalTime: formatDuration(Math.round(totalSeconds / 60)),
                        totalDurationSeconds: totalSeconds,
                        startTime: routeStartTime,
                        eta: routeEta || 'Unknown',
                        isBest: false
                    } as RouteOption;
                }
            }
            return null;
        });

        const routes = (await Promise.all(routePromises)).filter((r): r is RouteOption => r !== null);

        // Sort routes: valid routes by ETA (earliest arrival first), error routes at end
        routes.sort((a, b) => {
            if (a.hasError && !b.hasError) return 1;
            if (!a.hasError && b.hasError) return -1;
            if (a.hasError && b.hasError) return 0;
            // Sort by actual ETA (ISO 8601 strings compare correctly)
            const etaA = a.eta || '';
            const etaB = b.eta || '';
            return etaA.localeCompare(etaB);
        });
        // Only mark best if it doesn't have an error
        if (routes.length > 0 && !routes[0].hasError) routes[0].isBest = true;

        const response: CommuteResponse = { direction: direction as 'toOffice' | 'toHome', lastUpdated: new Date().toISOString(), routes, _version: 'v1.3.1-fix-train-times' };
        res.status(200).json(response);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to calculate commute' });
    }
}
