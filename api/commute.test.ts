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
