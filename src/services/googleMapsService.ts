/**
 * Google Maps Routes API Service (v2)
 * Uses the new Routes API with improved performance and features
 * https://developers.google.com/maps/documentation/routes
 */

// Load API key from environment variable
// IMPORTANT: Never commit your API key to git!
// Add your key to .env file (see .env.example for template)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('Missing VITE_GOOGLE_MAPS_API_KEY environment variable. Please add it to your .env file.');
}

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export type RouteSegment = {
  from: string;
  to: string;
  duration: string;
  distance: string;
  traffic?: string;
  departureTime?: string;
};

export type RouteData = {
  totalDuration: string;
  segments: RouteSegment[];
};

/**
 * Fetch driving directions using the new Routes API
 */
export async function fetchDrivingDirections(
  origin: string,
  destination: string,
): Promise<RouteSegment | null> {
  try {
    const requestBody = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
      },
      languageCode: 'en-US',
      units: 'IMPERIAL',
    };

    const response = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 
          'routes.duration,routes.distanceMeters,routes.legs.startLocation,routes.legs.endLocation,routes.legs.staticDuration,routes.legs.localizedValues,routes.travelAdvisory',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // Log any API errors
    if (data.error) {
      console.error('Routes API Error:', JSON.stringify(data.error, null, 2));
      console.error('Status:', response.status);
      return null;
    }

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs?.[0];
      
      // Parse durations from seconds to minutes
      const durationWithTrafficSeconds = parseInt(route.duration.replace('s', ''));
      const staticDurationSeconds = leg?.staticDuration
        ? parseInt(leg.staticDuration.replace('s', ''))
        : durationWithTrafficSeconds;

      const durationMinutes = Math.round(durationWithTrafficSeconds / 60);
      const durationText = formatDuration(durationMinutes);
      
      // Convert distance from meters to miles
      const distanceMiles = (route.distanceMeters * 0.000621371).toFixed(1);
      
      // Calculate traffic impact by comparing duration vs staticDuration
      const trafficStatus = getTrafficStatusFromDurations(
        staticDurationSeconds,
        durationWithTrafficSeconds
      );

      return {
        from: origin,
        to: destination,
        duration: durationText,
        distance: `${distanceMiles} mi`,
        traffic: trafficStatus,
      };
    }

    console.warn('No routes found in response');
    return null;
  } catch (error) {
    console.error('Error fetching driving directions with Routes API:', error);
    return null;
  }
}

/**
 * Fetch transit directions using the new Routes API
 */
export async function fetchTransitDirections(
  origin: string,
  destination: string,
  departureTime?: Date,
): Promise<RouteSegment | null> {
  try {
    const requestBody: any = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: false,
      transitPreferences: {
        allowedTravelModes: ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL'],
      },
      languageCode: 'en-US',
      units: 'IMPERIAL',
    };

    // Add departure time if provided
    if (departureTime) {
      requestBody.departureTime = departureTime.toISOString();
    }

    const response = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.legs.staticDuration,routes.legs.steps.transitDetails.transitLine,routes.legs.steps.transitDetails.stopDetails.departureTime',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // Log any API errors
    if (data.error) {
      console.error('Routes API Transit Error:', JSON.stringify(data.error, null, 2));
      console.error('Status:', response.status);
      return null;
    }

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs?.[0];

      // Parse durations from seconds to minutes
      const durationSeconds = parseInt(route.duration.replace('s', ''));
      const staticDurationSeconds = leg?.staticDuration 
        ? parseInt(leg.staticDuration.replace('s', ''))
        : durationSeconds;
      
      const durationMinutes = Math.round(durationSeconds / 60);
      const durationText = formatDuration(durationMinutes);

      // Extract departure time from transit details
      let departureTime: string | undefined;
      const transitSteps = leg?.steps?.filter((step: any) => step.transitDetails);
      if (transitSteps && transitSteps.length > 0) {
        const firstTransitStep = transitSteps[0];
        const departureTimeData = firstTransitStep.transitDetails?.stopDetails?.departureTime;
        if (departureTimeData) {
          // Parse ISO 8601 datetime and format as local time
          const depDate = new Date(departureTimeData);
          departureTime = depDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
      }

      // Check for PATH train in transit steps
      const hasPath = leg?.steps?.some(
        (step: any) =>
          step.transitDetails?.transitLine?.nameShort === 'PATH' ||
          step.transitDetails?.transitLine?.name?.includes('PATH'),
      );

      // For transit, calculate if there are delays
      const delayMinutes = Math.round((durationSeconds - staticDurationSeconds) / 60);
      const transitStatus = delayMinutes > 2 
        ? `Delays (+${delayMinutes} min)` 
        : 'On time';

      return {
        from: origin,
        to: destination,
        duration: durationText,
        distance: hasPath ? 'PATH + walk' : `${(route.distanceMeters * 0.000621371).toFixed(1)} mi`,
        traffic: transitStatus,
        departureTime,
      };
    }

    console.warn('No transit routes found in response');
    return null;
  } catch (error) {
    console.error('Error fetching transit directions with Routes API:', error);
    return null;
  }
}

/**
 * Format duration from minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Determine traffic status by comparing actual duration vs baseline (no traffic)
 * This uses staticDuration (ideal conditions) vs duration (current traffic)
 */
function getTrafficStatusFromDurations(
  staticDurationSeconds: number,
  durationWithTrafficSeconds: number,
): string {
  // Calculate the delay caused by traffic
  const delaySeconds = durationWithTrafficSeconds - staticDurationSeconds;
  const delayPercentage = (delaySeconds / staticDurationSeconds) * 100;

  // Categorize traffic based on delay percentage
  if (delayPercentage < 5) {
    return 'Light traffic';
  } else if (delayPercentage < 15) {
    return 'Moderate traffic';
  } else if (delayPercentage < 30) {
    return 'Heavy traffic';
  } else if (delayPercentage >= 30) {
    return `Severe delays (+${Math.round(delaySeconds / 60)} min)`;
  } else {
    return 'Normal traffic';
  }
}

/**
 * Calculate total duration from segments
 */
export function calculateTotalDuration(segments: RouteSegment[]): string {
  let totalMinutes = 0;

  segments.forEach(segment => {
    // Parse durations like "35m", "1h 35m", "2h"
    const duration = segment.duration;
    
    // Extract hours (e.g., "1h" or "2h")
    const hoursMatch = duration.match(/(\d+)h/);
    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    }
    
    // Extract minutes (e.g., "35m" or "5m")
    const minutesMatch = duration.match(/(\d+)m/);
    if (minutesMatch) {
      totalMinutes += parseInt(minutesMatch[1], 10);
    }
  });

  return formatDuration(totalMinutes);
}
