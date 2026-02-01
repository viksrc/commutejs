import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/commute';

/**
 * This test verifies that if a route shows "Leave in X mins",
 * the first segment's departure time should be approximately X mins from now,
 * NOT the current time.
 */
test.describe('Leave Time Consistency Tests', () => {
    // Helper to parse time string "HH:MM AM/PM" to minutes since midnight
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

    test('first segment departure time should align with "leave in X mins"', async ({ request }) => {
        test.setTimeout(60000);

        const response = await request.get(`${API_URL}?direction=toOffice`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        for (const route of data.routes) {
            // Skip routes without transit (pure driving routes don't have "leave in" constraints)
            const hasTransit = route.segments.some((s: any) =>
                s.mode === 'path' || s.mode === 'train' || s.mode === 'bus'
            );
            if (!hasTransit) continue;

            const firstSegment = route.segments[0];
            expect(firstSegment.departureTime, `Route "${route.name}" first segment missing departure time`).toBeTruthy();

            const firstDepartureMinutes = parseTimeToMinutes(firstSegment.departureTime);
            expect(firstDepartureMinutes).toBeGreaterThan(-1);

            // Calculate expected departure based on transit schedule
            // The first segment departure should be AFTER current time if there's waiting involved
            // Specifically: if the API says the route has segments that start with current time,
            // but transit is later, the first segment should be offset

            // Find the first transit segment and its departure time
            const transitSegment = route.segments.find((s: any) =>
                s.mode === 'path' || s.mode === 'train' || s.mode === 'bus'
            );
            const transitDepartureMinutes = parseTimeToMinutes(transitSegment.departureTime);

            // Calculate time needed to reach transit from start
            let timeToReachTransit = 0;
            for (let i = 0; i < route.segments.indexOf(transitSegment); i++) {
                const seg = route.segments[i];
                const h = seg.duration.match(/(\d+)h/);
                const m = seg.duration.match(/(\d+)m/);
                timeToReachTransit += (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
            }

            // Expected first departure = transit departure - time to reach transit
            const expectedFirstDeparture = transitDepartureMinutes - timeToReachTransit;

            console.log(`Route: ${route.name}`);
            console.log(`  First segment departs: ${firstSegment.departureTime} (${firstDepartureMinutes} mins)`);
            console.log(`  Transit departs: ${transitSegment.departureTime} (${transitDepartureMinutes} mins)`);
            console.log(`  Time to reach transit: ${timeToReachTransit} mins`);
            console.log(`  Expected first departure: ${expectedFirstDeparture} mins`);
            console.log(`  Now: ${nowMinutes} mins`);

            // The first segment departure should be close to (transitDeparture - timeToReach)
            // Allow 2 minute tolerance for rounding
            const tolerance = 2;
            const difference = Math.abs(firstDepartureMinutes - expectedFirstDeparture);

            expect(
                difference,
                `Route "${route.name}": First segment departure (${firstSegment.departureTime}) should be ~${expectedFirstDeparture} mins, ` +
                `but got ${firstDepartureMinutes} mins. Transit is at ${transitSegment.departureTime}, ` +
                `takes ${timeToReachTransit} mins to reach. Difference: ${difference} mins`
            ).toBeLessThanOrEqual(tolerance);
        }
    });
});
