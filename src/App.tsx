/**
 * CommuteInfo - Your daily commute at a glance (Web Version)
 * Shows travel time from Home to Office (and reverse)
 */

import { useState, useEffect } from 'react';
import { LOCATIONS } from './config/locations';
import { getSchedule } from './services/lakelandBusService';

// Types for commute data
type CommuteSegment = {
  from: string;
  to: string;
  duration: string;
  distance: string;
  traffic?: string;
  mode?: 'drive' | 'walk' | 'train' | 'path' | 'bus';
  departureTime?: string;
  arrivalTime?: string;
};

type RouteOption = {
  name: string;
  totalTime: string;
  eta: string;
  segments: CommuteSegment[];
  isBest?: boolean;
  leaveInMins?: number;
};

type CommuteData = {
  direction: 'toOffice' | 'toHome';
  routes: RouteOption[];
  lastUpdated: string;
};

// SVG Icons - styled like SF Symbols
const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
  </svg>
);

const TrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </svg>
);

const WalkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
  </svg>
);

const TramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5l-1.59-1.59c1.52-.28 2.59-1.54 2.59-2.97zM12 4.5c2.71 0 5 .24 5 2v.5H7V6.5c0-1.76 2.29-2 5-2zM7 9h10v4H7V9zm2.5 8c-.83 0-1.5-.67-1.5-1.5S8.67 14 9.5 14s1.5.67 1.5 1.5S10.33 17 9.5 17zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </svg>
);

const BusIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
  </svg>
);

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
);

// Helper component to get icon for transportation mode
function ModeIcon({ mode }: { mode?: 'drive' | 'walk' | 'train' | 'path' | 'bus' }) {
  switch (mode) {
    case 'drive':
      return <CarIcon />;
    case 'walk':
      return <WalkIcon />;
    case 'train':
      return <TrainIcon />;
    case 'path':
      return <TramIcon />;
    case 'bus':
      return <BusIcon />;
    default:
      return <span className="mode-icon">•</span>;
  }
}

// Helper to get mode label
function getModeLabel(mode?: 'drive' | 'walk' | 'train' | 'path' | 'bus'): string {
  switch (mode) {
    case 'drive': return 'Drive';
    case 'walk': return 'Walk';
    case 'train': return 'Train';
    case 'path': return 'PATH';
    case 'bus': return 'Bus';
    default: return '';
  }
}

// Helper to get traffic class
function getTrafficClass(traffic?: string): string {
  if (!traffic) return '';
  const lower = traffic.toLowerCase();
  if (lower.includes('light') || lower.includes('on time')) return 'light';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('heavy') || lower.includes('severe') || lower.includes('delay')) return 'heavy';
  return '';
}

// Helper function to open Google Maps with directions
function openGoogleMaps(segment: CommuteSegment) {
  // Map our modes to Google Maps travel modes
  let travelMode = 'driving'; // default
  switch (segment.mode) {
    case 'drive':
      travelMode = 'driving';
      break;
    case 'walk':
      travelMode = 'walking';
      break;
    case 'train':
    case 'path':
      travelMode = 'transit';
      break;
  }

  // Try to get actual addresses from LOCATIONS
  let fromAddress = segment.from;
  let toAddress = segment.to;

  // Map common names to actual addresses
  Object.values(LOCATIONS).forEach((location) => {
    if (
      location.name.toLowerCase().includes(segment.from.toLowerCase()) ||
      segment.from.toLowerCase().includes(location.name.toLowerCase())
    ) {
      fromAddress = location.address;
    }
    if (
      location.name.toLowerCase().includes(segment.to.toLowerCase()) ||
      segment.to.toLowerCase().includes(location.name.toLowerCase())
    ) {
      toAddress = location.address;
    }
  });

  // Create Google Maps web URL
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    fromAddress
  )}&destination=${encodeURIComponent(toAddress)}&travelmode=${travelMode}`;

  window.open(url, '_blank');
}

// Helper to format "Leave in X mins" display
function formatLeaveTime(minutes: number): string {
  if (minutes <= 0) return 'Now!';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}


// Helper to parse duration string to minutes
function parseDurationToMinutes(duration: string): number {
  const hoursMatch = duration.match(/(\d+)h/);
  const minutesMatch = duration.match(/(\d+)m/);

  let totalMinutes = 0;
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }
  return totalMinutes;
}

// Helper to parse time string (e.g., "6:20 AM") to Date object for today
function parseTimeToDate(timeStr: string): Date | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  return result;
}

// Calculate "Leave in X mins" based on first transit departure time
function calculateLeaveInMins(segments: CommuteSegment[], routeName: string): number | null {
  // Find the first transit segment (path or train)
  let transitSegmentIndex = -1;
  let transitDepartureTime: Date | null = null;
  let transitDepartureTimeStr = '';

  console.log(`\n=== calculateLeaveInMins for "${routeName}" ===`);
  console.log('Segments:', segments.map((s, i) => `[${i}] ${s.mode}: ${s.from}→${s.to} (${s.duration}) traffic="${s.traffic}" departureTime="${s.departureTime}"`));

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.mode === 'path' || segment.mode === 'train' || segment.mode === 'bus') {
      transitSegmentIndex = i;

      // Try to get departure time from departureTime field first
      if (segment.departureTime) {
        transitDepartureTime = parseTimeToDate(segment.departureTime);
        transitDepartureTimeStr = segment.departureTime;
      }

      // If no departureTime, try to parse from traffic field (e.g., "Departs 6:20 AM")
      if (!transitDepartureTime && segment.traffic) {
        const departsMatch = segment.traffic.match(/Departs\s+(.+)/i);
        if (departsMatch) {
          transitDepartureTime = parseTimeToDate(departsMatch[1]);
          transitDepartureTimeStr = departsMatch[1];
        }
      }

      if (transitDepartureTime) {
        console.log(`Found transit segment at index ${i}: ${segment.mode} ${segment.from}→${segment.to}`);
        console.log(`Transit departure time string: "${transitDepartureTimeStr}"`);
        console.log(`Parsed transit departure time: ${transitDepartureTime.toLocaleTimeString()}`);
        break;
      }
    }
  }

  // If no transit segment found or no departure time, return null
  if (transitSegmentIndex === -1 || !transitDepartureTime) {
    console.log('No transit segment with departure time found, returning null');
    return null;
  }

  // Calculate total duration of segments before the transit segment
  let priorMinutes = 0;
  for (let i = 0; i < transitSegmentIndex; i++) {
    const segDuration = parseDurationToMinutes(segments[i].duration);
    console.log(`Prior segment [${i}] ${segments[i].from}→${segments[i].to}: ${segments[i].duration} = ${segDuration} mins`);
    priorMinutes += segDuration;
  }
  console.log(`Total prior minutes: ${priorMinutes}`);

  // Calculate commute start time = transit departure - prior segments duration
  const commuteStartTime = new Date(transitDepartureTime.getTime() - priorMinutes * 60000);
  console.log(`Commute start time: ${commuteStartTime.toLocaleTimeString()} (transit ${transitDepartureTime.toLocaleTimeString()} - ${priorMinutes}m)`);

  // Buffer: 5 mins for Harrison route, 2 mins otherwise
  const buffer = routeName.toLowerCase().includes('harrison') ? 5 : 2;
  console.log(`Buffer: ${buffer} mins`);

  // Calculate leave in mins = start time - now - buffer
  const now = new Date();
  const leaveInMins = Math.round((commuteStartTime.getTime() - now.getTime()) / 60000) - buffer;
  console.log(`Now: ${now.toLocaleTimeString()}`);
  console.log(`Leave in mins: (${commuteStartTime.toLocaleTimeString()} - ${now.toLocaleTimeString()}) - ${buffer} = ${leaveInMins}`);

  return leaveInMins;
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [direction, setDirection] = useState<'toOffice' | 'toHome'>('toOffice');
  const [commuteData, setCommuteData] = useState<CommuteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set()); // No routes expanded by default

  // Listen for dark mode changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Pre-fetch Lakeland Bus schedule on mount
  useEffect(() => {
    getSchedule().catch(err => console.error('Bus schedule load failed:', err));
  }, []);

  // Fetch commute data from backend API
  const fetchCommuteData = async (dir: 'toOffice' | 'toHome') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/commute?direction=${dir}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const apiData = await response.json();

      // Calculate leave in mins for each route (still done client-side for real-time accuracy)
      const routes = apiData.routes.map((route: RouteOption) => ({
        ...route,
        leaveInMins: calculateLeaveInMins(route.segments, route.name) ?? undefined,
      }));

      const data: CommuteData = {
        direction: dir,
        routes,
        lastUpdated: new Date().toLocaleTimeString(),
      };

      setCommuteData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load commute data';
      console.error('Error fetching commute data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when direction changes
  useEffect(() => {
    fetchCommuteData(direction);
    setExpandedRoutes(new Set()); // No routes expanded by default
  }, [direction]);



  const toggleRouteExpansion = (routeIndex: number) => {
    setExpandedRoutes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(routeIndex)) {
        newSet.delete(routeIndex);
      } else {
        newSet.add(routeIndex);
      }
      return newSet;
    });
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="container">
        {/* Header */}
        <div className="header">
          <h1 className="title">Commute Info</h1>
        </div>

        {/* Direction Toggle */}
        <div className="toggle-container">
          <button
            className={`toggle-button ${direction === 'toOffice' ? 'active' : ''}`}
            onClick={() => setDirection('toOffice')}
          >
            To Work
          </button>
          <button
            className={`toggle-button ${direction === 'toHome' ? 'active' : ''}`}
            onClick={() => setDirection('toHome')}
          >
            To Home
          </button>
        </div>

        {/* Commute Summary */}
        {loading && !commuteData ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">Failed to load routes</p>
            <p className="error-details">{error}</p>
            <button className="retry-button" onClick={() => fetchCommuteData(direction)}>
              Retry
            </button>
          </div>
        ) : commuteData ? (
          <>
            {/* Routes - iOS Style Cards */}
            {commuteData.routes.map((route, routeIndex) => {
              const isExpanded = expandedRoutes.has(routeIndex);

              return (
                <div
                  key={routeIndex}
                  className={`route-card ${route.isBest ? 'best' : ''}`}
                  onClick={() => toggleRouteExpansion(routeIndex)}
                >
                  {/* Route Header */}
                  <div className="route-header">
                    <div>
                      <div className="route-name-container">
                        {route.isBest && <span className="star-icon">★</span>}
                        <span className="route-name">{route.name}</span>
                      </div>
                      <div className="route-info">
                        <ClockIcon />
                        <span className="total-time">{route.totalTime}</span>
                      </div>
                    </div>
                    <div className="time-container">
                      <button
                        className={`expand-button ${isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRouteExpansion(routeIndex);
                        }}
                      >
                        <ChevronIcon expanded={isExpanded} />
                      </button>
                      {route.leaveInMins !== undefined && (
                        <span className={`leave-time ${route.leaveInMins <= 0 ? 'urgent' : route.leaveInMins <= 5 ? 'soon' : ''}`}>
                          Leave: {formatLeaveTime(route.leaveInMins)}
                        </span>
                      )}
                      <span className="eta">ETA: {route.eta}</span>
                    </div>
                  </div>

                  {/* Segments (Shown only if expanded) */}
                  {isExpanded && (
                    <div className="segments-container">
                      {route.segments.map((segment, index) => (
                        <div key={index} className="segment-row">
                          {/* Left side - icon with connecting line */}
                          <div className="segment-left">
                            <div className="segment-icon">
                              <ModeIcon mode={segment.mode} />
                            </div>
                            {index < route.segments.length - 1 && (
                              <div className="segment-line"></div>
                            )}
                          </div>

                          {/* Segment Content */}
                          <div className="segment-content">
                            <div className="segment-route">
                              {segment.from} → {segment.to}
                            </div>
                            <div className="segment-details">
                              <span>{getModeLabel(segment.mode)}</span>
                              <span className="separator">•</span>
                              <span>{segment.duration}</span>
                              {/* Show time range for all segments */}
                              {segment.departureTime && (
                                <>
                                  <span className="separator">•</span>
                                  <span className="segment-times">
                                    {segment.departureTime}{segment.arrivalTime ? ` → ${segment.arrivalTime}` : ''}
                                  </span>
                                </>
                              )}
                              {segment.traffic && segment.mode === 'drive' && (
                                <>
                                  <span className="separator">•</span>
                                  <span className={`segment-traffic ${getTrafficClass(segment.traffic)}`}>
                                    {segment.traffic.replace(' traffic', '')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Map Button */}
                          <button
                            className="map-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openGoogleMaps(segment);
                            }}
                          >
                            <MapIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Last Updated */}
            <p className="updated-text">Updated {commuteData.lastUpdated}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default App;
