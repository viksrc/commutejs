import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/commute';

/**
 * API Invariant Tests
 * These tests verify that the API response satisfies basic logical constraints
 */
test.describe('API Invariant Tests', () => {
    function parseTimeToMinutes(timeStr: string): number {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return -1;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        else if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    function parseDurationToMinutes(duration: string): number {
        const h = duration.match(/(\d+)h/);
        const m = duration.match(/(\d+)m/);
        return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
    }

    test('should have no negative durations', async ({ request }) => {
        test.setTimeout(60000);

        for (const direction of ['toOffice', 'toHome']) {
            const response = await request.get(`${API_URL}?direction=${direction}`);
            expect(response.status()).toBe(200);

            const data = await response.json();

            for (const route of data.routes) {
                console.log(`\nChecking route: ${route.name} (${direction})`);

                for (const segment of route.segments) {
                    const durationMins = parseDurationToMinutes(segment.duration);

                    console.log(`  ${segment.from} → ${segment.to}: ${segment.duration} (${durationMins} mins)`);
                    console.log(`    Depart: ${segment.departureTime}, Arrive: ${segment.arrivalTime}`);

                    expect(
                        durationMins,
                        `Segment "${segment.from} → ${segment.to}" in route "${route.name}" has negative duration: ${segment.duration}`
                    ).toBeGreaterThan(0);
                }

                // Also check total time
                const totalMins = parseDurationToMinutes(route.totalTime);
                expect(
                    totalMins,
                    `Route "${route.name}" has negative total time: ${route.totalTime}`
                ).toBeGreaterThan(0);
            }
        }
    });

    test('segment times should be internally consistent', async ({ request }) => {
        test.setTimeout(60000);

        for (const direction of ['toOffice', 'toHome']) {
            const response = await request.get(`${API_URL}?direction=${direction}`);
            expect(response.status()).toBe(200);

            const data = await response.json();

            for (const route of data.routes) {
                console.log(`\nChecking route: ${route.name} (${direction})`);

                for (const segment of route.segments) {
                    const depMins = parseTimeToMinutes(segment.departureTime);
                    const arrMins = parseTimeToMinutes(segment.arrivalTime);
                    const durationMins = parseDurationToMinutes(segment.duration);

                    console.log(`  ${segment.from} → ${segment.to}:`);
                    console.log(`    Departure: ${segment.departureTime} (${depMins} mins)`);
                    console.log(`    Arrival: ${segment.arrivalTime} (${arrMins} mins)`);
                    console.log(`    Duration: ${segment.duration} (${durationMins} mins)`);
                    console.log(`    Calculated: ${arrMins - depMins} mins`);

                    // The arrival - departure should equal the duration (with tolerance for rounding)
                    const actualDuration = arrMins - depMins;
                    const tolerance = 2; // 2 minute tolerance for rounding

                    expect(
                        Math.abs(actualDuration - durationMins),
                        `Segment "${segment.from} → ${segment.to}" in route "${route.name}": ` +
                        `Duration mismatch. Stated: ${durationMins} mins, Calculated: ${actualDuration} mins ` +
                        `(${segment.departureTime} → ${segment.arrivalTime})`
                    ).toBeLessThanOrEqual(tolerance);
                }
            }
        }
    });

    test('route total time should match sum of segments', async ({ request }) => {
        test.setTimeout(60000);

        for (const direction of ['toOffice', 'toHome']) {
            const response = await request.get(`${API_URL}?direction=${direction}`);
            expect(response.status()).toBe(200);

            const data = await response.json();

            for (const route of data.routes) {
                console.log(`\nChecking route: ${route.name} (${direction})`);

                // Calculate total from first departure to last arrival
                const firstDep = parseTimeToMinutes(route.segments[0].departureTime);
                const lastArr = parseTimeToMinutes(route.segments[route.segments.length - 1].arrivalTime);
                const calculatedTotal = lastArr - firstDep;

                const statedTotal = parseDurationToMinutes(route.totalTime);

                console.log(`  First departure: ${route.segments[0].departureTime} (${firstDep} mins)`);
                console.log(`  Last arrival: ${route.segments[route.segments.length - 1].arrivalTime} (${lastArr} mins)`);
                console.log(`  Calculated total: ${calculatedTotal} mins`);
                console.log(`  Stated total: ${route.totalTime} (${statedTotal} mins)`);

                const tolerance = 2;
                expect(
                    Math.abs(calculatedTotal - statedTotal),
                    `Route "${route.name}": Total time mismatch. ` +
                    `Stated: ${statedTotal} mins, Calculated: ${calculatedTotal} mins`
                ).toBeLessThanOrEqual(tolerance);
            }
        }
    });

    test('first segment should start at reasonable time relative to transit', async ({ request }) => {
        test.setTimeout(60000);

        const response = await request.get(`${API_URL}?direction=toOffice`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        for (const route of data.routes) {
            const hasTransit = route.segments.some((s: any) =>
                s.mode === 'path' || s.mode === 'train' || s.mode === 'bus'
            );
            if (!hasTransit) continue;

            const firstDepMins = parseTimeToMinutes(route.segments[0].departureTime);

            console.log(`\nRoute: ${route.name}`);
            console.log(`  Now: ${nowMinutes} mins`);
            console.log(`  First departure: ${route.segments[0].departureTime} (${firstDepMins} mins)`);
            console.log(`  Difference: ${firstDepMins - nowMinutes} mins`);

            // First departure should be within reasonable range (not in the past, not more than 3 hours in future)
            expect(
                firstDepMins,
                `Route "${route.name}": First departure (${route.segments[0].departureTime}) should not be in the past`
            ).toBeGreaterThanOrEqual(nowMinutes - 5); // 5 min tolerance for processing time

            expect(
                firstDepMins,
                `Route "${route.name}": First departure (${route.segments[0].departureTime}) is too far in the future`
            ).toBeLessThanOrEqual(nowMinutes + 180); // Max 3 hours in future
        }
    });
});
