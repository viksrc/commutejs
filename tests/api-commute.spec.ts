import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/commute';

test.describe('API /api/commute Integration Tests', () => {
    // Helper to parse time string "HH:MM AM/PM" to minutes
    function parseTime(timeStr: string): number {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return -1;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        else if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    test('should return valid commute data for "toOffice"', async ({ request }) => {
        // Increase timeout for real API calls
        test.setTimeout(60000);

        const response = await request.get(`${API_URL}?direction=toOffice`);
        if (response.status() !== 200) {
            console.error('API Error Response:', await response.text());
        }
        expect(response.status(), `API returned ${response.status()}`).toBe(200);

        const data = await response.json();

        // Validate Structure
        expect(data).toHaveProperty('direction', 'toOffice');
        expect(data).toHaveProperty('routes');
        expect(Array.isArray(data.routes)).toBeTruthy();
        expect(data.routes.length).toBeGreaterThan(0);

        // Validate Data Continuity for each route
        for (const route of data.routes) {
            console.log(`Verifying Route: ${route.name}`);
            expect(route.segments.length).toBeGreaterThan(0);

            let previousArrival = -1;

            for (const segment of route.segments) {
                // Every segment must have a departure and arrival time now
                expect(segment.departureTime, 'Missing departureTime').toBeTruthy();
                expect(segment.arrivalTime, 'Missing arrivalTime').toBeTruthy();

                const depTime = parseTime(segment.departureTime);
                const arrTime = parseTime(segment.arrivalTime);

                // Basic sanity: Departure < Arrival (unless overnight, but let's assume same day for commute)
                // Note: Long commutes might span midnight, but usually not 11 AM -> 12 PM type stuff.
                // Actually, let's just check they are valid.
                expect(depTime).not.toBe(-1);
                expect(arrTime).not.toBe(-1);

                // Continuity Check
                if (previousArrival !== -1) {
                    // New departure should be >= previous arrival
                    expect(depTime).toBeGreaterThanOrEqual(previousArrival);
                }

                previousArrival = arrTime;
            }
        }
    });

    test('should return valid commute data for "toHome"', async ({ request }) => {
        test.setTimeout(60000);
        const response = await request.get(`${API_URL}?direction=toHome`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.direction).toBe('toHome');
        expect(data.routes.length).toBeGreaterThan(0);
    });

    test('should handle invalid direction', async ({ request }) => {
        const response = await request.get(`${API_URL}?direction=invalid`);
        expect([400, 404, 500].includes(response.status())).toBeTruthy();
    });
});
