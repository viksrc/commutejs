import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSchedule } from './services/lakelandBus.js';

// ============ TYPES ============
// All times in API are ISO 8601 UTC strings (e.g., "2026-02-02T14:30:00.000Z")
interface CommuteSegment {
    mode: 'drive' | 'walk' | 'train' | 'path' | 'bus';
    from: string;
    to: string;
    fromLabel?: string;
    toLabel?: string;
    duration: string;
    durationSeconds: number;
    distance?: string;
    trafficDelayMins?: number;  // Delay in minutes vs no-traffic duration
    departureTime?: string;  // ISO 8601 UTC
    arrivalTime?: string;    // ISO 8601 UTC
    error?: string;
}

interface RouteOption {
    name: string;
    totalDurationSeconds?: number;
    startTime?: string;      // ISO 8601 UTC - when to leave
    eta?: string;            // ISO 8601 UTC - arrival time
    isBest?: boolean;
    hasError?: boolean;
    segments: CommuteSegment[];
}

interface CommuteResponse {
    direction: 'toOffice' | 'toHome';
    asOf: string;            // ISO 8601 UTC - the reference time used for calculations
    lastUpdated: string;     // ISO 8601 UTC
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
            duration: formatDuration(durationSeconds),
            durationSeconds,
            distance: `${distanceMiles} mi`,
            trafficDelayMins: getTrafficDelayMins(staticDurationSeconds, durationSeconds),
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

    // Google API expects ISO 8601 UTC
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

        // Sort routes by duration and pick the fastest
        const sortedRoutes = data.routes.sort((a: any, b: any) => {
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

        // Extract departure/arrival times as ISO 8601 UTC strings
        let departureTimeISO: string | undefined;
        let arrivalTimeISO: string | undefined;
        const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
        if (transitSteps && transitSteps.length > 0) {
            const first = transitSteps[0].transitDetails?.stopDetails?.departureTime;
            const last = transitSteps[transitSteps.length - 1].transitDetails?.stopDetails?.arrivalTime;
            // Google returns ISO 8601 strings - keep them as-is
            if (first) departureTimeISO = new Date(first).toISOString();
            if (last) arrivalTimeISO = new Date(last).toISOString();
        }

        return {
            from: origin,
            to: destination,
            duration: formatDuration(durationSeconds),
            durationSeconds,
            distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
            trafficDelayMins: delayMinutes,
            departureTime: departureTimeISO,
            arrivalTime: arrivalTimeISO,
        };
    } catch (error) {
        console.error('Error fetching transit directions:', error);
        return null;
    }
}

function getTrafficDelayMins(staticDuration: number, actualDuration: number): number {
    return Math.round((actualDuration - staticDuration) / 60);
}

// ============ HELPERS ============

/**
 * Parse duration string (e.g., "1h 30m", "45m") to seconds
 */
function parseDurationToSeconds(duration: string): number {
    const h = duration.match(/(\d+)h/);
    const m = duration.match(/(\d+)m/);
    return ((h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0)) * 60;
}

/**
 * Format seconds to human-readable duration string
 */
function formatDuration(seconds: number): string {
    const totalMinutes = Math.round(seconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Get the current UTC offset for America/New_York timezone on a given date.
 * Returns offset in minutes (e.g., -300 for EST, -240 for EDT)
 */
function getNYOffsetMinutes(date: Date): number {
    // Create a formatter that gives us the timezone offset
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '-05:00';

    // Parse offset like "GMT-5" or "GMT-4"
    const match = offsetPart.match(/GMT([+-])(\d+)/);
    if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2]);
        return sign * hours * 60;
    }
    return -300; // Default to EST (-5 hours)
}

/**
 * Convert a NY local time string (e.g., "4:29 AM") to a UTC Date object.
 * Uses the reference date to determine the correct date and DST offset.
 */
function nyTimeStringToUTC(timeStr: string, referenceDate: Date): Date | null {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;

    // Get the NY date components for the reference date
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = nyFormatter.formatToParts(referenceDate);
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // JS months are 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')!.value);

    // Get the NY offset for this date
    const offsetMinutes = getNYOffsetMinutes(referenceDate);

    // Create the UTC timestamp:
    // If it's 4:29 AM in NY and NY is UTC-5, then UTC time is 4:29 + 5:00 = 9:29 AM
    const nyTimeMs = Date.UTC(year, month, day, hours, minutes, 0);
    const utcMs = nyTimeMs - (offsetMinutes * 60 * 1000);

    return new Date(utcMs);
}

/**
 * Get NY time components (hour, minute, dayOfWeek) from a UTC Date
 */
function getTimeInNY(utcDate: Date): { hours: number; minutes: number; dayOfWeek: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false
    });
    const parts = formatter.formatToParts(utcDate);

    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');
    const weekdayPart = parts.find(p => p.type === 'weekday');

    const hours = parseInt(hourPart?.value || '0');
    const minutes = parseInt(minutePart?.value || '0');

    // Convert weekday name to number (0 = Sunday)
    const weekdayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const dayOfWeek = weekdayMap[weekdayPart?.value || 'Mon'] ?? 1;

    return { hours, minutes, dayOfWeek };
}

/**
 * Find the next bus departure after the given UTC arrival time.
 * Lakeland bus schedules are in NY local time, so we convert to NY to compare,
 * then return the bus departure as a UTC timestamp.
 */
async function findNextBus(arrivalTimeUTC: Date, direction: 'eastbound' | 'westbound'): Promise<{ departureTimeUTC: Date; waitSeconds: number } | null> {
    const schedule = await getSchedule();

    // Get NY time components for the arrival time
    const nyTime = getTimeInNY(arrivalTimeUTC);
    const type = (nyTime.dayOfWeek === 0 || nyTime.dayOfWeek === 6) ? 'weekend' : 'weekday';
    const times = schedule.schedules[type][direction];
    if (!times || times.length === 0) return null;

    const arrivalMinutesInNY = nyTime.hours * 60 + nyTime.minutes;

    // Find the next bus (times are like "4:50 AM", "5:20 AM", etc.)
    for (const timeStr of times) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) continue;

        let hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        const busMinutesInNY = hour * 60 + minute;

        if (busMinutesInNY >= arrivalMinutesInNY) {
            // Convert this NY time to UTC
            const departureTimeUTC = nyTimeStringToUTC(timeStr, arrivalTimeUTC);
            if (departureTimeUTC) {
                const waitSeconds = (departureTimeUTC.getTime() - arrivalTimeUTC.getTime()) / 1000;
                return { departureTimeUTC, waitSeconds };
            }
        }
    }

    return null; // No more buses today
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { direction, asOf } = req.query;

    if (direction !== 'toOffice' && direction !== 'toHome') {
        return res.status(400).json({ error: 'Invalid direction. Use toOffice or toHome.' });
    }

    // Parse asOf parameter (ISO 8601 UTC) or default to current UTC time
    let asOfDate: Date;
    if (typeof asOf === 'string' && asOf) {
        asOfDate = new Date(asOf);
        if (isNaN(asOfDate.getTime())) {
            return res.status(400).json({ error: 'Invalid asOf parameter. Use ISO 8601 format (e.g., 2026-02-02T14:30:00.000Z).' });
        }
    } else {
        asOfDate = new Date(); // Current UTC time
    }

    try {
        const routesConfig = ROUTES_CONFIG[direction];
        const routes: RouteOption[] = [];

        for (const routeConfig of routesConfig) {
            // === PASS 1: Collect all segments with durations (times not yet set) ===
            interface SegmentData {
                segment: CommuteSegment;
                fixedDepartureTimeUTC?: Date; // For transit/bus segments with schedules
                hasError?: boolean;
            }
            const segmentData: SegmentData[] = [];
            let estimatedSecondsFromStart = 0; // Running total in seconds
            let routeHasError = false;

            for (const segConfig of routeConfig.segments) {
                let segment: Partial<CommuteSegment> | null = null;
                let fixedDepartureTimeUTC: Date | undefined;
                let segmentHasError = false;

                // Estimate arrival time at this segment (UTC) for transit lookups
                const estimatedArrivalAtSegmentUTC = new Date(asOfDate.getTime() + estimatedSecondsFromStart * 1000);

                if (segConfig.type === 'drive') {
                    const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                    if (driveRes) {
                        segment = { ...driveRes, mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel };
                    } else {
                        segment = { mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', durationSeconds: 0, error: 'Google API error' };
                        segmentHasError = true;
                        routeHasError = true;
                    }
                } else if (segConfig.type === 'walk') {
                    const walkDurationSeconds = parseDurationToSeconds(segConfig.duration);
                    segment = {
                        mode: 'walk',
                        from: segConfig.fromLabel,
                        to: segConfig.toLabel,
                        duration: segConfig.duration,
                        durationSeconds: walkDurationSeconds,
                        distance: '-'
                    };
                } else if (segConfig.type === 'transit') {
                    // Pass the estimated arrival time (UTC) so Google returns the correct route
                    const transitRes = await fetchTransitDirections(
                        LOCATIONS[segConfig.from].address,
                        LOCATIONS[segConfig.to].address,
                        estimatedArrivalAtSegmentUTC
                    );
                    if (transitRes) {
                        segment = { ...transitRes, mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel };
                        // departureTime from Google is already ISO 8601 UTC
                        if (transitRes.departureTime) {
                            fixedDepartureTimeUTC = new Date(transitRes.departureTime);
                        }
                    } else {
                        segment = { mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', durationSeconds: 0, error: 'Google API error' };
                        segmentHasError = true;
                        routeHasError = true;
                    }
                } else if (segConfig.type === 'bus') {
                    const nextBus = await findNextBus(estimatedArrivalAtSegmentUTC, segConfig.direction);
                    if (nextBus) {
                        const driveRes = await fetchDrivingDirections(LOCATIONS[segConfig.from].address, LOCATIONS[segConfig.to].address);
                        const busDurationSeconds = driveRes?.durationSeconds || 2700; // 45 min default
                        const busDuration = driveRes?.duration || '45m';
                        const arrivalTimeUTC = new Date(nextBus.departureTimeUTC.getTime() + busDurationSeconds * 1000);

                        segment = {
                            mode: 'bus',
                            from: segConfig.fromLabel,
                            to: segConfig.toLabel,
                            duration: busDuration,
                            durationSeconds: busDurationSeconds,
                            distance: driveRes?.distance || '30 mi',
                            departureTime: nextBus.departureTimeUTC.toISOString(),
                            arrivalTime: arrivalTimeUTC.toISOString()
                        };
                        fixedDepartureTimeUTC = nextBus.departureTimeUTC;
                    } else {
                        segment = { mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', durationSeconds: 0, error: 'No buses available' };
                        segmentHasError = true;
                        routeHasError = true;
                    }
                }

                if (segment) {
                    segmentData.push({ segment: segment as CommuteSegment, fixedDepartureTimeUTC, hasError: segmentHasError });
                    if (!segmentHasError && segment.durationSeconds) {
                        estimatedSecondsFromStart += segment.durationSeconds;
                    }
                }
            }

            if (segmentData.length === 0) continue;

            // === PASS 2: Find first fixed transit time and calculate backwards ===
            let firstFixedTransitIndex = -1;
            let firstFixedTransitTimeUTC: Date | null = null;

            for (let i = 0; i < segmentData.length; i++) {
                if (segmentData[i].fixedDepartureTimeUTC) {
                    firstFixedTransitIndex = i;
                    firstFixedTransitTimeUTC = segmentData[i].fixedDepartureTimeUTC!;
                    break;
                }
            }

            // Calculate the ideal start time by working backwards from the first transit
            let idealStartTimeUTC: Date;
            if (firstFixedTransitTimeUTC && firstFixedTransitIndex > 0) {
                // Sum up durations of all segments BEFORE the first transit
                let secondsToReachTransit = 0;
                for (let i = 0; i < firstFixedTransitIndex; i++) {
                    secondsToReachTransit += segmentData[i].segment.durationSeconds || 0;
                }
                // Start time = transit departure - time to reach it
                idealStartTimeUTC = new Date(firstFixedTransitTimeUTC.getTime() - secondsToReachTransit * 1000);
            } else {
                // No fixed transit, just start at asOf time
                idealStartTimeUTC = asOfDate;
            }

            // === PASS 3: Assign times to all segments starting from idealStartTimeUTC ===
            const segments: CommuteSegment[] = [];
            let currentTimeUTC = idealStartTimeUTC;

            for (let i = 0; i < segmentData.length; i++) {
                const sd = segmentData[i];
                const segment = { ...sd.segment };

                // Skip time assignment for error segments
                if (sd.hasError) {
                    delete segment.departureTime;
                    delete segment.arrivalTime;
                    segments.push(segment);
                    continue;
                }

                // Check if this segment has a fixed scheduled departure (transit/bus)
                if (sd.fixedDepartureTimeUTC && sd.fixedDepartureTimeUTC > currentTimeUTC) {
                    // There's a wait - the transit doesn't leave until the scheduled time
                    currentTimeUTC = sd.fixedDepartureTimeUTC;
                }

                // Set departure time as ISO 8601 UTC
                segment.departureTime = currentTimeUTC.toISOString();

                // Calculate arrival time
                const durationSeconds = segment.durationSeconds || 0;
                const arrivalDateUTC = new Date(currentTimeUTC.getTime() + durationSeconds * 1000);
                segment.arrivalTime = arrivalDateUTC.toISOString();

                // Advance current time to arrival
                currentTimeUTC = arrivalDateUTC;

                segments.push(segment);
            }

            if (segments.length > 0) {
                if (routeHasError) {
                    // Route has errors - don't show total time or eta
                    routes.push({ name: routeConfig.name, segments, hasError: true, isBest: false });
                } else {
                    // Calculate total duration in seconds
                    const startTimeUTC = new Date(segments[0].departureTime!);
                    const endTimeUTC = new Date(segments[segments.length - 1].arrivalTime!);
                    const totalDurationSeconds = Math.round((endTimeUTC.getTime() - startTimeUTC.getTime()) / 1000);

                    routes.push({
                        name: routeConfig.name,
                        segments,
                        totalDurationSeconds,
                        startTime: segments[0].departureTime,
                        eta: segments[segments.length - 1].arrivalTime,
                        isBest: false
                    });
                }
            }
        }

        // Sort routes: valid routes by duration, error routes at end
        routes.sort((a, b) => {
            if (a.hasError && !b.hasError) return 1;
            if (!a.hasError && b.hasError) return -1;
            if (a.hasError && b.hasError) return 0;
            return (a.totalDurationSeconds || 0) - (b.totalDurationSeconds || 0);
        });

        // Only mark best if it doesn't have an error
        if (routes.length > 0 && !routes[0].hasError) routes[0].isBest = true;

        const response: CommuteResponse = {
            direction: direction as 'toOffice' | 'toHome',
            asOf: asOfDate.toISOString(),
            lastUpdated: new Date().toISOString(),
            routes
        };
        res.status(200).json(response);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to calculate commute' });
    }
}
