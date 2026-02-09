import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Reproduces the Hoboken route timing bug:
 *
 *   Home → Morris Plains     Drive   6m     4:20 PM → 4:26 PM
 *   Morris Plains → Parking  Walk    3m     4:26 PM → 4:29 PM
 *   Morris Plains → Hoboken  Train   1h11m  4:20 PM → 5:32 PM  ← BUG: departs before walk ends
 *   Hoboken → Office         PATH    10m    5:50 PM → 6:00 PM
 *
 * The train departs at 4:20 PM but the user doesn't arrive at the station
 * until 4:29 PM. The route shows an impossible schedule.
 */

vi.mock('./services/lakelandBus.js', () => ({
    getSchedule: vi.fn().mockResolvedValue({
        schedules: {
            weekday: { eastbound: ['06:00', '07:00'], westbound: ['17:00', '18:00'] },
            weekend: { eastbound: [], westbound: [] },
        },
    }),
}));

// Times from the user's example (EST = UTC-5, Feb 9 is winter)
const DEPARTURE  = '2026-02-09T21:20:00.000Z'; // 4:20 PM ET — "Leave Now"
const TRAIN_DEP  = '2026-02-09T21:20:00.000Z'; // 4:20 PM ET — same as departure
const TRAIN_ARR  = '2026-02-09T22:32:00.000Z'; // 5:32 PM ET
const PATH_DEP   = '2026-02-09T22:50:00.000Z'; // 5:50 PM ET
const PATH_ARR   = '2026-02-09T23:00:00.000Z'; // 6:00 PM ET

// Station coordinates (from LOCATIONS in commute.ts)
const MORRIS_PLAINS_LAT = 40.82864;
const HOBOKEN_LAT = 40.7349;
const HARRISON_LAT = 40.7394;
const NY_PENN_LAT = 40.750374;
const PORT_AUTHORITY_LAT = 40.757309;
const WTC_LAT = 40.71271;

/** Identify an origin by its latitude (coords) or address substring */
function identifyOrigin(body: any): string {
    const lat = body.origin?.location?.latLng?.latitude;
    if (lat) {
        if (Math.abs(lat - MORRIS_PLAINS_LAT) < 0.01) return 'morrisPlains';
        if (Math.abs(lat - HOBOKEN_LAT) < 0.01) return 'hoboken';
        if (Math.abs(lat - HARRISON_LAT) < 0.01) return 'harrison';
        if (Math.abs(lat - NY_PENN_LAT) < 0.01) return 'nyPenn';
        if (Math.abs(lat - PORT_AUTHORITY_LAT) < 0.01) return 'portAuthority';
        if (Math.abs(lat - WTC_LAT) < 0.01) return 'wtc';
    }
    const addr = body.origin?.address || '';
    if (addr.includes('Morris Plains')) return 'morrisPlains';
    if (addr.includes('Hoboken')) return 'hoboken';
    if (addr.includes('Harrison')) return 'harrison';
    return 'unknown';
}

/** Identify destination similarly */
function identifyDest(body: any): string {
    const lat = body.destination?.location?.latLng?.latitude;
    if (lat) {
        if (Math.abs(lat - MORRIS_PLAINS_LAT) < 0.01) return 'morrisPlains';
        if (Math.abs(lat - HOBOKEN_LAT) < 0.01) return 'hoboken';
        if (Math.abs(lat - HARRISON_LAT) < 0.01) return 'harrison';
        if (Math.abs(lat - NY_PENN_LAT) < 0.01) return 'nyPenn';
        if (Math.abs(lat - PORT_AUTHORITY_LAT) < 0.01) return 'portAuthority';
        if (Math.abs(lat - WTC_LAT) < 0.01) return 'wtc';
    }
    const addr = body.destination?.address || '';
    if (addr.includes('Morris Plains')) return 'morrisPlains';
    if (addr.includes('Hoboken')) return 'hoboken';
    if (addr.includes('200 West')) return 'office';
    if (addr.includes('Harrison')) return 'harrison';
    return 'unknown';
}

function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
        timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
    });
}

/** Build a Google Routes API transit response */
function transitResponse(dep: string, arr: string, durationSec: number, distMeters: number, lineName: string, lineShort?: string) {
    return {
        ok: true,
        json: async () => ({
            routes: [{
                duration: `${durationSec}s`,
                distanceMeters: distMeters,
                legs: [{
                    staticDuration: `${durationSec}s`,
                    steps: [{
                        transitDetails: {
                            stopDetails: { departureTime: dep, arrivalTime: arr },
                            transitLine: {
                                name: lineName,
                                ...(lineShort ? { nameShort: lineShort } : {}),
                            },
                        },
                    }],
                }],
            }],
        }),
    };
}

/** Build a Google Routes API driving response */
function driveResponse(durationSec: number, distMeters: number) {
    return {
        ok: true,
        json: async () => ({
            routes: [{
                duration: `${durationSec}s`,
                distanceMeters: distMeters,
                legs: [{ staticDuration: `${durationSec}s` }],
            }],
        }),
    };
}

interface TrackedCall {
    travelMode: string;
    origin: string;
    dest: string;
    direction: 'forward' | 'backward' | 'n/a';
    constraint?: string;
    allowedModes?: string[];
}

/**
 * Mock fetch that tracks every call and returns realistic responses
 * for each pass of the routing algorithm:
 *
 * PASS 1 (forward):  fetchTransitDirections with departureTime
 * PASS 2 (backward): fetchTransitDirectionsWithArrival with arrivalTime
 */
function createMockFetch() {
    const trackedCalls: TrackedCall[] = [];

    const mockFn = vi.fn().mockImplementation(async (_url: string, options: any) => {
        const body = JSON.parse(options.body);
        const origin = identifyOrigin(body);
        const dest = identifyDest(body);
        const hasDepartureTime = !!body.departureTime;
        const hasArrivalTime = !!body.arrivalTime;

        const tracked: TrackedCall = {
            travelMode: body.travelMode,
            origin,
            dest,
            direction: hasDepartureTime ? 'forward' : hasArrivalTime ? 'backward' : 'n/a',
            constraint: body.departureTime || body.arrivalTime || undefined,
            allowedModes: body.transitPreferences?.allowedTravelModes,
        };
        trackedCalls.push(tracked);

        // --- DRIVE: always 6 minutes ---
        if (body.travelMode === 'DRIVE') {
            console.log(`    [DRIVE] ${origin} → ${dest}: 6m`);
            return driveResponse(360, 9656);
        }

        // --- TRANSIT ---
        if (body.travelMode === 'TRANSIT') {

            // ── Morris Plains → Hoboken (TRAIN) ──
            if (origin === 'morrisPlains' && dest === 'hoboken') {
                if (hasDepartureTime) {
                    // PASS 1 forward: Google returns the 4:20 PM train.
                    // The handler's filter will reject it (4:20 < 4:29 currentCommuteTime)
                    // but the fallback at line 271 restores it — this is part of the bug.
                    console.log(`    [PASS1 TRANSIT forward] morrisPlains → hoboken  depart=${fmtTime(body.departureTime)}  → returns 4:20 PM train`);
                    return transitResponse(TRAIN_DEP, TRAIN_ARR, 4260, 48280, 'NJ Transit Morristown Line');
                }
                if (hasArrivalTime) {
                    // PASS 2 backward: "find latest train arriving by X".
                    // Returns the same 4:20 PM train (arrives 5:32, before the 5:45 constraint).
                    // Line 676 checks: 4:20 PM >= requestedDepartureTime (4:20 PM) → passes.
                    console.log(`    [PASS2 TRANSIT backward] morrisPlains → hoboken  arrive-by=${fmtTime(body.arrivalTime)}  → returns 4:20 PM train`);
                    return transitResponse(TRAIN_DEP, TRAIN_ARR, 4260, 48280, 'NJ Transit Morristown Line');
                }
            }

            // ── Hoboken → Office (PATH) ──
            if (origin === 'hoboken') {
                if (hasDepartureTime) {
                    // PASS 1 forward: PATH after train arrival (5:32 PM). Returns 5:50 PM PATH.
                    console.log(`    [PASS1 TRANSIT forward] hoboken → ${dest}  depart=${fmtTime(body.departureTime)}  → returns 5:50 PM PATH`);
                    return transitResponse(PATH_DEP, PATH_ARR, 600, 3218, 'PATH', 'PATH');
                }
                if (hasArrivalTime) {
                    // PASS 2 backward would not reach here (PATH is the last fixed transit)
                    // but handle it anyway for robustness.
                    console.log(`    [PASS2 TRANSIT backward] hoboken → ${dest}  arrive-by=${fmtTime(body.arrivalTime)}  → returns 5:50 PM PATH`);
                    return transitResponse(PATH_DEP, PATH_ARR, 600, 3218, 'PATH', 'PATH');
                }
            }

            // ── All other transit (Harrison, Penn Station, Port Authority, etc.) ──
            const base = new Date(DEPARTURE);
            const genericDep = new Date(base.getTime() + 20 * 60000).toISOString();
            const genericArr = new Date(base.getTime() + 50 * 60000).toISOString();
            console.log(`    [TRANSIT other] ${origin} → ${dest}  → generic 30m`);
            return transitResponse(genericDep, genericArr, 1800, 16093, 'Generic Transit');
        }

        return { ok: false, json: async () => ({}) };
    });

    (mockFn as any).trackedCalls = trackedCalls;
    return mockFn;
}

describe('Hoboken route timing bug', () => {
    let savedFetch: typeof global.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        process.env.GOOGLE_MAPS_API_KEY = 'test-key';
        global.fetch = createMockFetch();
    });

    afterEach(() => {
        global.fetch = savedFetch;
        vi.restoreAllMocks();
    });

    it('each segment should depart at or after the previous segment arrives', async () => {
        vi.resetModules();
        const { default: handler } = await import('./commute');

        const req = { query: { direction: 'toOffice', asOf: DEPARTURE } } as any;
        let responseData: any = null;
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn((data: any) => { responseData = data; }),
        } as any;

        console.log('\n=== Calling handler (all 4 passes run) ===\n');
        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(responseData).not.toBeNull();

        // --- Verify the mock was called for all Hoboken route passes ---
        const calls = (global.fetch as any).trackedCalls as TrackedCall[];

        // PASS 1: forward drive call
        const hobokenDrive = calls.filter(
            c => c.travelMode === 'DRIVE' && c.origin === 'unknown' && c.dest === 'morrisPlains'
        );
        // PASS 1: forward train query (departureTime)
        const hobokenTrainForward = calls.filter(
            c => c.origin === 'morrisPlains' && c.dest === 'hoboken' && c.direction === 'forward'
        );
        // PASS 2: backward train re-query (arrivalTime)
        const hobokenTrainBackward = calls.filter(
            c => c.origin === 'morrisPlains' && c.dest === 'hoboken' && c.direction === 'backward'
        );
        // PASS 1: forward PATH query (departureTime)
        const hobokenPathForward = calls.filter(
            c => c.origin === 'hoboken' && c.direction === 'forward'
        );

        console.log('\n=== Hoboken route API calls ===');
        console.log(`  PASS 1 drive calls:          ${hobokenDrive.length}`);
        console.log(`  PASS 1 train forward calls:   ${hobokenTrainForward.length}`);
        console.log(`  PASS 1 PATH forward calls:    ${hobokenPathForward.length}`);
        console.log(`  PASS 2 train backward calls:  ${hobokenTrainBackward.length}`);

        expect(hobokenTrainForward.length, 'PASS 1 should query train forward').toBeGreaterThanOrEqual(1);
        expect(hobokenPathForward.length, 'PASS 1 should query PATH forward').toBeGreaterThanOrEqual(1);
        expect(hobokenTrainBackward.length, 'PASS 2 should re-query train backward').toBeGreaterThanOrEqual(1);

        // --- Check the Hoboken route output ---
        const hobokenRoute = responseData.routes.find((r: any) => r.name === 'Via Hoboken Station');
        expect(hobokenRoute, 'Via Hoboken Station route should exist').toBeDefined();
        expect(hobokenRoute.hasError, 'Hoboken route should not have errors').toBeFalsy();

        const segments = hobokenRoute.segments;
        expect(segments).toHaveLength(4);

        console.log('\n=== Final segment schedule ===');
        for (const seg of segments) {
            const dep = seg.departureTime ? fmtTime(seg.departureTime) : '?';
            const arr = seg.arrivalTime ? fmtTime(seg.arrivalTime) : '?';
            console.log(`  ${seg.from} → ${seg.to}  ${seg.mode}  ${seg.duration}  ${dep} → ${arr}`);
        }

        // THE KEY ASSERTION: each segment must depart at or after the previous one arrives
        console.log('\n=== Continuity check ===');
        for (let i = 1; i < segments.length; i++) {
            const prev = segments[i - 1];
            const curr = segments[i];

            if (prev.arrivalTime && curr.departureTime) {
                const prevArrival = new Date(prev.arrivalTime).getTime();
                const currDeparture = new Date(curr.departureTime).getTime();
                const gapMinutes = (currDeparture - prevArrival) / 60000;

                console.log(
                    `  ${prev.to} arrival → ${curr.from} departure: ` +
                    `${gapMinutes >= 0 ? '+' : ''}${gapMinutes.toFixed(0)}m ` +
                    `${gapMinutes < 0 ? '← OVERLAP (impossible)' : '(ok)'}`
                );

                expect(
                    currDeparture,
                    `"${curr.from} → ${curr.to}" (${curr.mode}) departs at ${fmtTime(curr.departureTime)} ` +
                    `but "${prev.from} → ${prev.to}" doesn't arrive until ${fmtTime(prev.arrivalTime)}. ` +
                    `That's ${Math.abs(gapMinutes).toFixed(0)} min before the user arrives!`
                ).toBeGreaterThanOrEqual(prevArrival);
            }
        }
    });
});
