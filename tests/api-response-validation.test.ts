import { describe, it, expect } from 'vitest';

/**
 * Tests against the live Vercel API to validate response format
 * These tests should FAIL if the API is returning invalid data
 */

const API_URL = 'https://commutejs.vercel.app/api/commute';

interface CommuteSegment {
  mode: string;
  from: string;
  to: string;
  duration: string;
  departureTime?: string;
  arrivalTime?: string;
  error?: string;
}

interface RouteOption {
  name: string;
  totalTime?: string;
  eta?: string;
  hasError?: boolean;
  segments: CommuteSegment[];
}

interface CommuteResponse {
  direction: string;
  lastUpdated: string;
  routes: RouteOption[];
}

describe('Vercel API Response Validation', () => {
  it('should return valid response for toOffice direction', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    expect(response.ok, 'API should return 200').toBe(true);

    const data: CommuteResponse = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    // Basic structure checks
    expect(data.direction).toBe('toOffice');
    expect(data.lastUpdated).toBeDefined();
    expect(Array.isArray(data.routes)).toBe(true);
    expect(data.routes.length).toBeGreaterThan(0);
  }, 30000);

  it('should have valid ETA times (not "Invalid Date")', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      // ETA should be parseable as a date or be a valid time string
      if (route.eta) {
        const etaDate = new Date(route.eta);
        const isValidDate = !isNaN(etaDate.getTime());
        const isTimeString = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(route.eta);

        expect(
          isValidDate || isTimeString,
          `Route "${route.name}" has invalid ETA: "${route.eta}"`
        ).toBe(true);
      }
    }
  }, 30000);

  it('should have valid segment departure/arrival times', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      for (const segment of route.segments) {
        if (segment.error) continue;

        // Check departureTime if present
        if (segment.departureTime) {
          const depDate = new Date(segment.departureTime);
          const isValidDate = !isNaN(depDate.getTime());
          const isTimeString = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(segment.departureTime);

          expect(
            isValidDate || isTimeString,
            `Segment "${segment.from} → ${segment.to}" has invalid departureTime: "${segment.departureTime}"`
          ).toBe(true);
        }

        // Check arrivalTime if present
        if (segment.arrivalTime) {
          const arrDate = new Date(segment.arrivalTime);
          const isValidDate = !isNaN(arrDate.getTime());
          const isTimeString = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(segment.arrivalTime);

          expect(
            isValidDate || isTimeString,
            `Segment "${segment.from} → ${segment.to}" has invalid arrivalTime: "${segment.arrivalTime}"`
          ).toBe(true);
        }
      }
    }
  }, 30000);

  it('should not have Lakeland API errors for bus routes', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    const busRoute = data.routes.find(r => r.name.includes('Port Authority') || r.name.includes('Bus'));

    if (busRoute) {
      const busSegment = busRoute.segments.find(s => s.mode === 'bus');
      if (busSegment) {
        expect(
          busSegment.error,
          `Bus segment has error: "${busSegment.error}"`
        ).toBeUndefined();
      }
    }
  }, 30000);

  it('should have valid totalTime format', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      if (route.totalTime) {
        // Should be like "1h 30m" or "45m"
        const isValidFormat = /^(\d+h\s*)?\d+m$/.test(route.totalTime);
        expect(
          isValidFormat,
          `Route "${route.name}" has invalid totalTime format: "${route.totalTime}"`
        ).toBe(true);
      }
    }
  }, 30000);
});
