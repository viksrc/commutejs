import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * TDD Tests for parallel route processing refactor
 *
 * Goal: Process routes in parallel instead of sequentially to reduce API latency
 */

// Mock types matching the actual implementation
interface CommuteSegment {
    mode: 'drive' | 'walk' | 'train' | 'path' | 'bus';
    from: string;
    to: string;
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
    isBest?: boolean;
    hasError?: boolean;
    segments: CommuteSegment[];
}

type SegmentConfig =
    | { type: 'drive'; from: string; to: string; fromLabel: string; toLabel: string }
    | { type: 'walk'; fromLabel: string; toLabel: string; duration: string }
    | { type: 'transit'; from: string; to: string; fromLabel: string; toLabel: string; mode: 'train' | 'path' }
    | { type: 'bus'; direction: 'eastbound' | 'westbound'; from: string; to: string; fromLabel: string; toLabel: string };

type RouteConfig = { name: string; segments: SegmentConfig[] };

// Import functions to test (will be exported after refactor)
// For now, we define the expected interfaces

describe('Parallel Route Processing', () => {
    // Mock API functions
    const mockFetchDrivingDirections = vi.fn();
    const mockFetchTransitDirections = vi.fn();
    const mockFindNextBus = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockFetchDrivingDirections.mockResolvedValue({
            duration: '30m',
            distance: '15 mi',
            traffic: 'Light traffic',
            durationSeconds: 1800
        });

        mockFetchTransitDirections.mockResolvedValue({
            duration: '25m',
            distance: 'PATH',
            traffic: 'On time',
            departureTime: '8:30 AM',
            arrivalTime: '8:55 AM'
        });

        mockFindNextBus.mockResolvedValue({
            departureTime: new Date().toISOString()
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('processRoute()', () => {
        it('should process a single drive-only route', async () => {
            const routeConfig: RouteConfig = {
                name: 'Drive Direct',
                segments: [
                    { type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' }
                ]
            };

            // The function should return a RouteOption with segments populated
            // This test defines the expected behavior
            const result = await processRouteMock(routeConfig, mockFetchDrivingDirections, mockFetchTransitDirections, mockFindNextBus);

            expect(result.name).toBe('Drive Direct');
            expect(result.segments).toHaveLength(1);
            expect(result.segments[0].mode).toBe('drive');
            expect(result.segments[0].duration).toBe('30m');
            expect(mockFetchDrivingDirections).toHaveBeenCalledTimes(1);
        });

        it('should process a multi-segment route with walk and transit', async () => {
            const routeConfig: RouteConfig = {
                name: 'Via Harrison PATH',
                segments: [
                    { type: 'drive', from: 'home', to: 'harrisonParking', fromLabel: 'Home', toLabel: 'Harrison Parking' },
                    { type: 'walk', fromLabel: 'Harrison Parking', toLabel: 'Harrison PATH', duration: '5m' },
                    { type: 'transit', from: 'harrisonPath', to: 'wtcPath', fromLabel: 'Harrison', toLabel: 'WTC PATH', mode: 'path' },
                    { type: 'walk', fromLabel: 'WTC PATH', toLabel: 'Office', duration: '5m' }
                ]
            };

            const result = await processRouteMock(routeConfig, mockFetchDrivingDirections, mockFetchTransitDirections, mockFindNextBus);

            expect(result.name).toBe('Via Harrison PATH');
            expect(result.segments).toHaveLength(4);
            expect(result.segments[0].mode).toBe('drive');
            expect(result.segments[1].mode).toBe('walk');
            expect(result.segments[2].mode).toBe('path');
            expect(result.segments[3].mode).toBe('walk');
        });

        it('should handle API errors gracefully and set hasError flag', async () => {
            mockFetchDrivingDirections.mockResolvedValue(null);

            const routeConfig: RouteConfig = {
                name: 'Drive Direct',
                segments: [
                    { type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' }
                ]
            };

            const result = await processRouteMock(routeConfig, mockFetchDrivingDirections, mockFetchTransitDirections, mockFindNextBus);

            expect(result.hasError).toBe(true);
            expect(result.segments[0].error).toBeDefined();
        });
    });

    describe('processAllRoutesInParallel()', () => {
        it('should process multiple routes in parallel', async () => {
            const routeConfigs: RouteConfig[] = [
                {
                    name: 'Drive Direct',
                    segments: [{ type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' }]
                },
                {
                    name: 'Via Harrison PATH',
                    segments: [
                        { type: 'drive', from: 'home', to: 'harrisonParking', fromLabel: 'Home', toLabel: 'Harrison Parking' },
                        { type: 'walk', fromLabel: 'Harrison Parking', toLabel: 'Harrison PATH', duration: '5m' }
                    ]
                }
            ];

            const startTime = Date.now();
            const results = await processAllRoutesInParallelMock(
                routeConfigs,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );
            const endTime = Date.now();

            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Drive Direct');
            expect(results[1].name).toBe('Via Harrison PATH');

            // Both routes should have been processed
            // Drive segments: 1 from first route + 1 from second route = 2 calls
            expect(mockFetchDrivingDirections).toHaveBeenCalledTimes(2);
        });

        it('should handle mixed success and failure routes', async () => {
            // First call succeeds, second fails
            mockFetchDrivingDirections
                .mockResolvedValueOnce({ duration: '30m', distance: '15 mi', traffic: 'Light traffic' })
                .mockResolvedValueOnce(null);

            const routeConfigs: RouteConfig[] = [
                {
                    name: 'Route 1',
                    segments: [{ type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' }]
                },
                {
                    name: 'Route 2',
                    segments: [{ type: 'drive', from: 'home', to: 'other', fromLabel: 'Home', toLabel: 'Other' }]
                }
            ];

            const results = await processAllRoutesInParallelMock(
                routeConfigs,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );

            expect(results).toHaveLength(2);
            expect(results[0].hasError).toBeFalsy();
            expect(results[1].hasError).toBe(true);
        });

        it('should sort results with valid routes first, errors last', async () => {
            mockFetchDrivingDirections
                .mockResolvedValueOnce(null) // First route fails
                .mockResolvedValueOnce({ duration: '30m', distance: '15 mi', traffic: 'Light traffic' }); // Second succeeds

            const routeConfigs: RouteConfig[] = [
                {
                    name: 'Failing Route',
                    segments: [{ type: 'drive', from: 'home', to: 'office', fromLabel: 'Home', toLabel: 'Office' }]
                },
                {
                    name: 'Working Route',
                    segments: [{ type: 'drive', from: 'home', to: 'other', fromLabel: 'Home', toLabel: 'Other' }]
                }
            ];

            const results = await processAllRoutesInParallelMock(
                routeConfigs,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );

            // Valid routes should come first after sorting
            expect(results[0].hasError).toBeFalsy();
            expect(results[1].hasError).toBe(true);
        });
    });

    describe('prefetchDriveSegments()', () => {
        it('should fetch all drive segments in parallel before processing transit', async () => {
            const segments: SegmentConfig[] = [
                { type: 'drive', from: 'home', to: 'station', fromLabel: 'Home', toLabel: 'Station' },
                { type: 'walk', fromLabel: 'Station', toLabel: 'Platform', duration: '3m' },
                { type: 'transit', from: 'station', to: 'destination', fromLabel: 'Station', toLabel: 'Destination', mode: 'train' },
                { type: 'drive', from: 'destination', to: 'office', fromLabel: 'Destination', toLabel: 'Office' }
            ];

            // Simulate slow API calls
            mockFetchDrivingDirections.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ duration: '20m', distance: '10 mi', traffic: 'Light' }), 100))
            );

            const startTime = Date.now();
            const prefetchedData = await prefetchDriveSegmentsMock(segments, mockFetchDrivingDirections);
            const duration = Date.now() - startTime;

            // Both drive segments should be fetched
            expect(mockFetchDrivingDirections).toHaveBeenCalledTimes(2);

            // Should complete in ~100ms (parallel) not ~200ms (sequential)
            // Allow some margin for test execution overhead
            expect(duration).toBeLessThan(180);

            // Should return a map of segment index to prefetched data
            expect(prefetchedData.get(0)).toBeDefined();
            expect(prefetchedData.get(3)).toBeDefined();
        });

        it('should return empty results for segments that fail', async () => {
            mockFetchDrivingDirections.mockResolvedValue(null);

            const segments: SegmentConfig[] = [
                { type: 'drive', from: 'home', to: 'station', fromLabel: 'Home', toLabel: 'Station' }
            ];

            const prefetchedData = await prefetchDriveSegmentsMock(segments, mockFetchDrivingDirections);

            expect(prefetchedData.get(0)).toBeNull();
        });
    });

    describe('Route Timing Integrity', () => {
        it('should ensure each segment does not start before the previous segment ends', async () => {
            // Set up transit to return a fixed departure time in the future
            const transitDepartureDate = new Date(Date.now() + 30 * 60000); // 30 mins from now
            mockFetchTransitDirections.mockResolvedValue({
                duration: '25m',
                distance: 'Train',
                traffic: 'On time',
                departureTime: transitDepartureDate.toISOString(),
                arrivalTime: new Date(transitDepartureDate.getTime() + 25 * 60000).toISOString(),
                departureDate: transitDepartureDate,
                arrivalDate: new Date(transitDepartureDate.getTime() + 25 * 60000)
            });

            const routeConfig: RouteConfig = {
                name: 'Multi-segment Route',
                segments: [
                    { type: 'drive', from: 'home', to: 'station', fromLabel: 'Home', toLabel: 'Station' },
                    { type: 'walk', fromLabel: 'Station', toLabel: 'Platform', duration: '5m' },
                    { type: 'transit', from: 'station', to: 'destination', fromLabel: 'Platform', toLabel: 'Destination', mode: 'train' },
                    { type: 'walk', fromLabel: 'Destination', toLabel: 'Office', duration: '3m' }
                ]
            };

            const result = await processRouteWithTimingMock(
                routeConfig,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );

            // Verify each segment starts at or after the previous segment ends
            for (let i = 1; i < result.segments.length; i++) {
                const prevSegment = result.segments[i - 1];
                const currSegment = result.segments[i];

                if (prevSegment.arrivalTime && currSegment.departureTime && !prevSegment.error && !currSegment.error) {
                    const prevArrival = new Date(prevSegment.arrivalTime).getTime();
                    const currDeparture = new Date(currSegment.departureTime).getTime();

                    expect(
                        currDeparture,
                        `Segment "${currSegment.from} → ${currSegment.to}" starts at ${currSegment.departureTime} ` +
                        `but previous segment "${prevSegment.from} → ${prevSegment.to}" ends at ${prevSegment.arrivalTime}`
                    ).toBeGreaterThanOrEqual(prevArrival);
                }
            }
        });

        it('should ensure total duration equals time from first departure to last arrival', async () => {
            const transitDepartureDate = new Date(Date.now() + 30 * 60000);
            mockFetchTransitDirections.mockResolvedValue({
                duration: '25m',
                distance: 'Train',
                traffic: 'On time',
                departureTime: transitDepartureDate.toISOString(),
                arrivalTime: new Date(transitDepartureDate.getTime() + 25 * 60000).toISOString(),
                departureDate: transitDepartureDate,
                arrivalDate: new Date(transitDepartureDate.getTime() + 25 * 60000)
            });

            const routeConfig: RouteConfig = {
                name: 'Test Route',
                segments: [
                    { type: 'drive', from: 'home', to: 'station', fromLabel: 'Home', toLabel: 'Station' },
                    { type: 'walk', fromLabel: 'Station', toLabel: 'Platform', duration: '5m' },
                    { type: 'transit', from: 'station', to: 'office', fromLabel: 'Platform', toLabel: 'Office', mode: 'train' }
                ]
            };

            const result = await processRouteWithTimingMock(
                routeConfig,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );

            if (!result.hasError && result.segments.length > 0) {
                const firstSegment = result.segments[0];
                const lastSegment = result.segments[result.segments.length - 1];

                if (firstSegment.departureTime && lastSegment.arrivalTime) {
                    const firstDeparture = new Date(firstSegment.departureTime).getTime();
                    const lastArrival = new Date(lastSegment.arrivalTime).getTime();
                    const actualDurationMs = lastArrival - firstDeparture;
                    const actualDurationMins = Math.round(actualDurationMs / 60000);

                    // Parse totalTime (e.g., "1h 30m" or "45m")
                    const totalTimeMins = parseDurationToMinutes(result.totalTime || '0m');

                    expect(
                        actualDurationMins,
                        `Total duration ${result.totalTime} (${totalTimeMins}m) doesn't match ` +
                        `actual time span from ${firstSegment.departureTime} to ${lastSegment.arrivalTime} (${actualDurationMins}m)`
                    ).toBe(totalTimeMins);
                }
            }
        });

        it('should not have segment departure before route start time', async () => {
            const transitDepartureDate = new Date(Date.now() + 30 * 60000);
            mockFetchTransitDirections.mockResolvedValue({
                duration: '25m',
                distance: 'Train',
                traffic: 'On time',
                departureTime: transitDepartureDate.toISOString(),
                arrivalTime: new Date(transitDepartureDate.getTime() + 25 * 60000).toISOString(),
                departureDate: transitDepartureDate,
                arrivalDate: new Date(transitDepartureDate.getTime() + 25 * 60000)
            });

            const routeConfig: RouteConfig = {
                name: 'Test Route',
                segments: [
                    { type: 'drive', from: 'home', to: 'station', fromLabel: 'Home', toLabel: 'Station' },
                    { type: 'walk', fromLabel: 'Station', toLabel: 'Platform', duration: '3m' },
                    { type: 'transit', from: 'station', to: 'office', fromLabel: 'Platform', toLabel: 'Office', mode: 'train' }
                ]
            };

            const result = await processRouteWithTimingMock(
                routeConfig,
                mockFetchDrivingDirections,
                mockFetchTransitDirections,
                mockFindNextBus
            );

            if (!result.hasError && result.segments.length > 0) {
                const routeStartTime = new Date(result.segments[0].departureTime!).getTime();

                for (const segment of result.segments) {
                    if (segment.departureTime && !segment.error) {
                        const segmentDeparture = new Date(segment.departureTime).getTime();
                        expect(
                            segmentDeparture,
                            `Segment "${segment.from} → ${segment.to}" departs at ${segment.departureTime} ` +
                            `which is before route start time`
                        ).toBeGreaterThanOrEqual(routeStartTime);
                    }
                }
            }
        });
    });
});

// Mock implementations for TDD - these will be replaced by actual imports after refactor

async function processRouteMock(
    routeConfig: RouteConfig,
    fetchDriving: typeof vi.fn,
    fetchTransit: typeof vi.fn,
    findBus: typeof vi.fn
): Promise<RouteOption> {
    const segments: CommuteSegment[] = [];
    let hasError = false;

    for (const segConfig of routeConfig.segments) {
        if (segConfig.type === 'drive') {
            const result = await fetchDriving(segConfig.from, segConfig.to);
            if (result) {
                segments.push({
                    mode: 'drive',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: result.duration,
                    distance: result.distance,
                    traffic: result.traffic
                });
            } else {
                segments.push({
                    mode: 'drive',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: '-',
                    error: 'API error'
                });
                hasError = true;
            }
        } else if (segConfig.type === 'walk') {
            segments.push({
                mode: 'walk',
                from: segConfig.fromLabel,
                to: segConfig.toLabel,
                duration: segConfig.duration
            });
        } else if (segConfig.type === 'transit') {
            const result = await fetchTransit(segConfig.from, segConfig.to);
            if (result) {
                segments.push({
                    mode: segConfig.mode,
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: result.duration,
                    departureTime: result.departureTime,
                    arrivalTime: result.arrivalTime
                });
            } else {
                segments.push({
                    mode: segConfig.mode,
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: '-',
                    error: 'API error'
                });
                hasError = true;
            }
        } else if (segConfig.type === 'bus') {
            const busResult = await findBus(new Date(), segConfig.direction);
            const driveResult = await fetchDriving(segConfig.from, segConfig.to);
            if (busResult && driveResult) {
                segments.push({
                    mode: 'bus',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: driveResult.duration,
                    departureTime: busResult.departureTime
                });
            } else {
                segments.push({
                    mode: 'bus',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: '-',
                    error: 'API error'
                });
                hasError = true;
            }
        }
    }

    return {
        name: routeConfig.name,
        segments,
        hasError: hasError || undefined
    };
}

async function processAllRoutesInParallelMock(
    routeConfigs: RouteConfig[],
    fetchDriving: typeof vi.fn,
    fetchTransit: typeof vi.fn,
    findBus: typeof vi.fn
): Promise<RouteOption[]> {
    // Process all routes in parallel using Promise.all
    const results = await Promise.all(
        routeConfigs.map(config => processRouteMock(config, fetchDriving, fetchTransit, findBus))
    );

    // Sort: valid routes by duration first, error routes last
    results.sort((a, b) => {
        if (a.hasError && !b.hasError) return 1;
        if (!a.hasError && b.hasError) return -1;
        return 0;
    });

    return results;
}

async function prefetchDriveSegmentsMock(
    segments: SegmentConfig[],
    fetchDriving: typeof vi.fn
): Promise<Map<number, any>> {
    const driveSegmentIndices = segments
        .map((seg, idx) => ({ seg, idx }))
        .filter(({ seg }) => seg.type === 'drive');

    const results = await Promise.all(
        driveSegmentIndices.map(async ({ seg, idx }) => {
            if (seg.type === 'drive') {
                const result = await fetchDriving(seg.from, seg.to);
                return { idx, result };
            }
            return { idx, result: null };
        })
    );

    const prefetchedData = new Map<number, any>();
    for (const { idx, result } of results) {
        prefetchedData.set(idx, result);
    }

    return prefetchedData;
}

// Helper to parse duration strings like "1h 30m" or "45m" to minutes
function parseDurationToMinutes(duration: string): number {
    const h = duration.match(/(\d+)h/);
    const m = duration.match(/(\d+)m/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
}

// Helper to format minutes to duration string
function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Process a route with proper timing - mirrors the actual implementation's 3-pass algorithm
 * PASS 1: Collect segments with durations
 * PASS 2: Find first fixed transit time and calculate backwards
 * PASS 3: Assign sequential times to all segments
 */
async function processRouteWithTimingMock(
    routeConfig: RouteConfig,
    fetchDriving: typeof vi.fn,
    fetchTransit: typeof vi.fn,
    findBus: typeof vi.fn
): Promise<RouteOption> {
    interface SegmentData {
        segment: CommuteSegment;
        fixedDepartureTime?: Date;
        hasError?: boolean;
    }

    const segmentData: SegmentData[] = [];
    let currentCommuteTime = new Date();
    let routeHasError = false;

    // PASS 1: Collect all segments with durations
    for (const segConfig of routeConfig.segments) {
        let segment: CommuteSegment | null = null;
        let fixedDepartureTime: Date | undefined;
        let segmentHasError = false;

        if (segConfig.type === 'drive') {
            const result = await fetchDriving(segConfig.from, segConfig.to);
            if (result) {
                segment = {
                    mode: 'drive',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: result.duration,
                    distance: result.distance,
                    traffic: result.traffic
                };
            } else {
                segment = { mode: 'drive', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        } else if (segConfig.type === 'walk') {
            segment = { mode: 'walk', from: segConfig.fromLabel, to: segConfig.toLabel, duration: segConfig.duration };
        } else if (segConfig.type === 'transit') {
            const result = await fetchTransit(segConfig.from, segConfig.to, currentCommuteTime);
            if (result) {
                segment = {
                    mode: segConfig.mode,
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: result.duration,
                    departureTime: result.departureTime,
                    arrivalTime: result.arrivalTime
                };
                // Use departureDate directly (the fix!)
                if (result.departureDate) {
                    fixedDepartureTime = result.departureDate;
                }
            } else {
                segment = { mode: segConfig.mode, from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        } else if (segConfig.type === 'bus') {
            const busResult = await findBus(currentCommuteTime, segConfig.direction);
            const driveResult = await fetchDriving(segConfig.from, segConfig.to);
            if (busResult && driveResult) {
                const busDepDate = new Date(busResult.departureTime);
                fixedDepartureTime = busDepDate;
                segment = {
                    mode: 'bus',
                    from: segConfig.fromLabel,
                    to: segConfig.toLabel,
                    duration: driveResult.duration,
                    departureTime: busDepDate.toISOString()
                };
            } else {
                segment = { mode: 'bus', from: segConfig.fromLabel, to: segConfig.toLabel, duration: '-', error: 'API error' };
                segmentHasError = true;
                routeHasError = true;
            }
        }

        if (segment) {
            segmentData.push({ segment, fixedDepartureTime, hasError: segmentHasError });
            // Update currentCommuteTime for next iteration
            if (!segmentHasError && segment.duration && segment.duration !== '-') {
                const durationMins = parseDurationToMinutes(segment.duration);
                if (fixedDepartureTime) {
                    currentCommuteTime = new Date(fixedDepartureTime.getTime() + durationMins * 60000);
                } else {
                    currentCommuteTime = new Date(currentCommuteTime.getTime() + durationMins * 60000);
                }
            }
        }
    }

    if (segmentData.length === 0) {
        return { name: routeConfig.name, segments: [], hasError: true };
    }

    // PASS 2: Find first fixed transit time and calculate backwards
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

    // PASS 3: Assign sequential times to all segments
    const segments: CommuteSegment[] = [];
    let currentTime = idealStartTime;

    for (let i = 0; i < segmentData.length; i++) {
        const sd = segmentData[i];
        const segment = { ...sd.segment };

        if (sd.hasError) {
            delete segment.departureTime;
            delete segment.arrivalTime;
            segments.push(segment);
            continue;
        }

        // If this segment has a fixed departure and it's after current time, wait
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
        return { name: routeConfig.name, segments, hasError: true };
    }

    let totalMinutes = 0;
    if (segments[0].departureTime && segments[segments.length - 1].arrivalTime) {
        const startTime = new Date(segments[0].departureTime);
        const endTime = new Date(segments[segments.length - 1].arrivalTime);
        totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    }

    return {
        name: routeConfig.name,
        segments,
        totalTime: formatDuration(totalMinutes)
    };
}
