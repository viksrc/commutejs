import { describe, it, expect } from 'vitest';

/**
 * Test to compare sequential vs parallel route processing
 *
 * This test simulates the API call pattern to demonstrate:
 * 1. Both approaches produce identical results
 * 2. Parallel is significantly faster
 */

// Simulate an API call with a delay (like Google Routes API)
async function simulatedApiCall(routeName: string, segmentName: string, delayMs: number = 200): Promise<{ route: string; segment: string; duration: string }> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return {
        route: routeName,
        segment: segmentName,
        duration: `${Math.floor(Math.random() * 60) + 30}m` // Random 30-90 min
    };
}

// Route configurations (simplified version of actual routes)
const ROUTES = [
    { name: 'Drive Direct', segments: ['drive-home-office'] },
    { name: 'Via Harrison PATH', segments: ['drive-home-harrison', 'transit-harrison-wtc'] },
    { name: 'Via Hoboken', segments: ['drive-home-morris', 'transit-morris-hoboken', 'transit-hoboken-wtc'] },
    { name: 'Via Penn Station', segments: ['drive-home-morris', 'transit-morris-penn', 'transit-penn-office'] },
    { name: 'Via Port Authority', segments: ['drive-home-waterview', 'bus-waterview-pa', 'transit-pa-office'] },
];

interface RouteResult {
    name: string;
    segments: { route: string; segment: string; duration: string }[];
    totalSegments: number;
}

describe('Sequential vs Parallel Route Processing', () => {

    it('should produce identical results with parallel being faster', async () => {
        const API_DELAY_MS = 100; // Simulated API latency per call

        // ============ SEQUENTIAL PROCESSING ============
        console.log('\n--- SEQUENTIAL PROCESSING ---');
        const sequentialStart = Date.now();
        const sequentialResults: RouteResult[] = [];

        for (const route of ROUTES) {
            const segments: RouteResult['segments'] = [];
            for (const segment of route.segments) {
                const result = await simulatedApiCall(route.name, segment, API_DELAY_MS);
                segments.push(result);
            }
            sequentialResults.push({
                name: route.name,
                segments,
                totalSegments: segments.length
            });
        }

        const sequentialTime = Date.now() - sequentialStart;
        console.log(`Sequential time: ${sequentialTime}ms`);
        console.log(`Routes processed: ${sequentialResults.length}`);

        // ============ PARALLEL PROCESSING ============
        console.log('\n--- PARALLEL PROCESSING ---');
        const parallelStart = Date.now();

        const routePromises = ROUTES.map(async (route) => {
            const segments: RouteResult['segments'] = [];
            for (const segment of route.segments) {
                const result = await simulatedApiCall(route.name, segment, API_DELAY_MS);
                segments.push(result);
            }
            return {
                name: route.name,
                segments,
                totalSegments: segments.length
            };
        });

        const parallelResults = await Promise.all(routePromises);

        const parallelTime = Date.now() - parallelStart;
        console.log(`Parallel time: ${parallelTime}ms`);
        console.log(`Routes processed: ${parallelResults.length}`);

        // ============ COMPARE RESULTS ============
        console.log('\n--- COMPARISON ---');
        console.log(`Sequential: ${sequentialTime}ms`);
        console.log(`Parallel:   ${parallelTime}ms`);
        console.log(`Speedup:    ${(sequentialTime / parallelTime).toFixed(2)}x faster`);
        console.log(`Time saved: ${sequentialTime - parallelTime}ms`);

        // Verify same number of routes
        expect(parallelResults.length).toBe(sequentialResults.length);

        // Verify same structure (segment counts match)
        for (let i = 0; i < ROUTES.length; i++) {
            expect(parallelResults[i].name).toBe(sequentialResults[i].name);
            expect(parallelResults[i].totalSegments).toBe(sequentialResults[i].totalSegments);
        }

        // Verify parallel is significantly faster (at least 2x)
        expect(parallelTime).toBeLessThan(sequentialTime / 2);

        console.log('\n✓ Results are structurally identical');
        console.log('✓ Parallel is significantly faster');

    }, 30000);

    it('should show expected timing math', async () => {
        const API_DELAY_MS = 100;

        // Count total API calls
        const totalApiCalls = ROUTES.reduce((sum, r) => sum + r.segments.length, 0);
        console.log(`\n--- TIMING MATH ---`);
        console.log(`Total API calls: ${totalApiCalls}`);
        console.log(`API delay per call: ${API_DELAY_MS}ms`);

        // Sequential: sum of all calls
        const expectedSequential = totalApiCalls * API_DELAY_MS;
        console.log(`\nSequential expected: ${totalApiCalls} calls × ${API_DELAY_MS}ms = ${expectedSequential}ms`);

        // Parallel: max of each route's total time
        const routeTimes = ROUTES.map(r => r.segments.length * API_DELAY_MS);
        const expectedParallel = Math.max(...routeTimes);
        console.log(`Parallel expected: max(${routeTimes.join(', ')}) = ${expectedParallel}ms`);

        console.log(`\nExpected speedup: ${(expectedSequential / expectedParallel).toFixed(2)}x`);

        expect(totalApiCalls).toBe(12); // 1 + 2 + 3 + 3 + 3 = 12
    });
});

describe('Live API Timing Test', () => {
    const API_URL = 'https://commutejs.vercel.app/api/commute';

    it('should measure actual API response time', async () => {
        console.log('\n--- LIVE API TIMING ---');

        const start = Date.now();
        const response = await fetch(`${API_URL}?direction=toOffice`);
        const data = await response.json();
        const elapsed = Date.now() - start;

        console.log(`API response time: ${elapsed}ms`);
        console.log(`Routes returned: ${data.routes?.length || 0}`);
        console.log(`Route names: ${data.routes?.map((r: any) => r.name).join(', ')}`);

        // Store this baseline - after parallel change, time should decrease
        console.log(`\n[BASELINE] Current API time: ${elapsed}ms`);
        console.log('After parallel change, expect this to be 2-4x faster');

        expect(response.ok).toBe(true);
        expect(data.routes.length).toBe(5);
    }, 30000);
});
