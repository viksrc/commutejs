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

/**
 * Mock fetch that returns responses matching the user's example:
 * - All drives: 6 minutes
 * - Train (Morris Plains → Hoboken): only the 4:20 PM train available
 * - PATH (Hoboken → Office): 5:50 PM → 6:00 PM
 */
function createMockFetch() {
    return vi.fn().mockImplementation(async (_url: string, options: any) => {
        const body = JSON.parse(options.body);

        // Driving: always return 6 minutes
        if (body.travelMode === 'DRIVE') {
            return {
                ok: true,
                json: async () => ({
                    routes: [{
                        duration: '360s',
                        distanceMeters: 9656,
                        legs: [{ staticDuration: '360s' }],
                    }],
                }),
            };
        }

        // Transit requests — distinguish by origin coordinates
        if (body.travelMode === 'TRANSIT') {
            const lat = body.origin?.location?.latLng?.latitude;

            // Morris Plains Station (lat ~40.829) → Hoboken
            if (lat && Math.abs(lat - 40.82864) < 0.01) {
                return {
                    ok: true,
                    json: async () => ({
                        routes: [{
                            duration: '4260s',
                            distanceMeters: 48280,
                            legs: [{
                                staticDuration: '4260s',
                                steps: [{
                                    transitDetails: {
                                        stopDetails: {
                                            departureTime: TRAIN_DEP,
                                            arrivalTime: TRAIN_ARR,
                                        },
                                        transitLine: { name: 'NJ Transit Morristown Line' },
                                    },
                                }],
                            }],
                        }],
                    }),
                };
            }

            // Hoboken Station (lat ~40.735) → Office (PATH)
            if (lat && Math.abs(lat - 40.7349) < 0.01) {
                return {
                    ok: true,
                    json: async () => ({
                        routes: [{
                            duration: '600s',
                            distanceMeters: 3218,
                            legs: [{
                                staticDuration: '600s',
                                steps: [{
                                    transitDetails: {
                                        stopDetails: {
                                            departureTime: PATH_DEP,
                                            arrivalTime: PATH_ARR,
                                        },
                                        transitLine: { nameShort: 'PATH', name: 'PATH' },
                                    },
                                }],
                            }],
                        }],
                    }),
                };
            }

            // All other transit requests — generic future transit
            const base = new Date(DEPARTURE);
            return {
                ok: true,
                json: async () => ({
                    routes: [{
                        duration: '1800s',
                        distanceMeters: 16093,
                        legs: [{
                            staticDuration: '1800s',
                            steps: [{
                                transitDetails: {
                                    stopDetails: {
                                        departureTime: new Date(base.getTime() + 20 * 60000).toISOString(),
                                        arrivalTime: new Date(base.getTime() + 50 * 60000).toISOString(),
                                    },
                                    transitLine: { name: 'Generic Transit' },
                                },
                            }],
                        }],
                    }],
                }),
            };
        }

        return { ok: false, json: async () => ({}) };
    });
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

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(responseData).not.toBeNull();

        const hobokenRoute = responseData.routes.find((r: any) => r.name === 'Via Hoboken Station');
        expect(hobokenRoute, 'Via Hoboken Station route should exist').toBeDefined();
        expect(hobokenRoute.hasError, 'Hoboken route should not have errors').toBeFalsy();

        const segments = hobokenRoute.segments;
        expect(segments).toHaveLength(4);

        // Print the schedule for debugging
        for (const seg of segments) {
            const dep = seg.departureTime ? new Date(seg.departureTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) : '?';
            const arr = seg.arrivalTime ? new Date(seg.arrivalTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) : '?';
            console.log(`  ${seg.from} → ${seg.to}  ${seg.mode}  ${seg.duration}  ${dep} → ${arr}`);
        }

        // THE KEY ASSERTION: each segment must depart at or after the previous one arrives
        for (let i = 1; i < segments.length; i++) {
            const prev = segments[i - 1];
            const curr = segments[i];

            if (prev.arrivalTime && curr.departureTime) {
                const prevArrival = new Date(prev.arrivalTime).getTime();
                const currDeparture = new Date(curr.departureTime).getTime();
                const gapMinutes = (prevArrival - currDeparture) / 60000;

                expect(
                    currDeparture,
                    `"${curr.from} → ${curr.to}" (${curr.mode}) departs at ${curr.departureTime} ` +
                    `but "${prev.from} → ${prev.to}" doesn't arrive until ${prev.arrivalTime}. ` +
                    `That's ${gapMinutes.toFixed(0)} min before the user arrives!`
                ).toBeGreaterThanOrEqual(prevArrival);
            }
        }
    });
});
