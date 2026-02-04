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
  totalDurationSeconds?: number;
  startTime?: string;
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

  it('should have all routes start at or after the requested asOf time', async () => {
    // Test with a future time (tomorrow at 7 AM NY time)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);
    const asOf = tomorrow.toISOString();

    const response = await fetch(`${API_URL}?direction=toOffice&asOf=${encodeURIComponent(asOf)}`);
    expect(response.ok, 'API should return 200').toBe(true);

    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      // Find the first segment's departure time (route start time)
      const firstSegment = route.segments[0];
      if (firstSegment && firstSegment.departureTime && !firstSegment.error) {
        const routeStartTime = new Date(firstSegment.departureTime);
        const requestedTime = new Date(asOf);

        expect(
          routeStartTime.getTime() >= requestedTime.getTime(),
          `Route "${route.name}" starts at ${routeStartTime.toISOString()} which is before requested time ${asOf}`
        ).toBe(true);
      }
    }
  }, 30000);

  it('should have all routes start at or after asOf time for toHome direction', async () => {
    // Test with a future time (tomorrow at 5 PM NY time)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    const asOf = tomorrow.toISOString();

    const response = await fetch(`${API_URL}?direction=toHome&asOf=${encodeURIComponent(asOf)}`);
    expect(response.ok, 'API should return 200').toBe(true);

    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      const firstSegment = route.segments[0];
      if (firstSegment && firstSegment.departureTime && !firstSegment.error) {
        const routeStartTime = new Date(firstSegment.departureTime);
        const requestedTime = new Date(asOf);

        expect(
          routeStartTime.getTime() >= requestedTime.getTime(),
          `Route "${route.name}" starts at ${routeStartTime.toISOString()} which is before requested time ${asOf}`
        ).toBe(true);
      }
    }
  }, 30000);

  it('should have totalDurationSeconds for non-error routes (required for UI duration display)', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      expect(
        typeof route.totalDurationSeconds === 'number' && route.totalDurationSeconds > 0,
        `Route "${route.name}" missing or invalid totalDurationSeconds: ${route.totalDurationSeconds}`
      ).toBe(true);
    }
  }, 30000);

  it('should have startTime for non-error routes (required for UI Leave time display)', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      // startTime should be a valid ISO 8601 date string
      expect(
        route.startTime && !isNaN(new Date(route.startTime).getTime()),
        `Route "${route.name}" missing or invalid startTime: ${route.startTime}`
      ).toBe(true);
    }
  }, 30000);

  it('should have startTime matching first segment departureTime', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;

      const firstSegment = route.segments[0];
      if (!firstSegment || firstSegment.error) continue;

      expect(
        route.startTime === firstSegment.departureTime,
        `Route "${route.name}" startTime (${route.startTime}) doesn't match first segment departureTime (${firstSegment.departureTime})`
      ).toBe(true);
    }
  }, 30000);

  it('should have totalDurationSeconds matching time from startTime to eta', async () => {
    const response = await fetch(`${API_URL}?direction=toOffice`);
    const data: CommuteResponse = await response.json();

    for (const route of data.routes) {
      if (route.hasError) continue;
      if (!route.startTime || !route.eta || !route.totalDurationSeconds) continue;

      const startDate = new Date(route.startTime);
      const etaDate = new Date(route.eta);
      const calculatedSeconds = Math.round((etaDate.getTime() - startDate.getTime()) / 1000);

      // Allow 2 second tolerance for rounding
      expect(
        Math.abs(calculatedSeconds - route.totalDurationSeconds) <= 2,
        `Route "${route.name}" totalDurationSeconds (${route.totalDurationSeconds}) doesn't match calculated (${calculatedSeconds})`
      ).toBe(true);
    }
  }, 30000);
});
