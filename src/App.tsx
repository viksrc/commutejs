/**
 * CommuteInfo - Your daily commute at a glance (Web Version)
 * Shows travel time from Home to Office (and reverse)
 */

import { useState, useEffect } from 'react';
import { LOCATIONS } from './config/locations';
import { getSchedule } from './services/lakelandBusService';

const APP_VERSION = '1.2.0';

// Types for commute data - times are ISO 8601 UTC from API
type CommuteSegment = {
  from: string;
  to: string;
  duration: string;
  durationSeconds: number;
  distance?: string;
  trafficDelayMins?: number;
  mode?: 'drive' | 'walk' | 'train' | 'path' | 'bus';
  departureTime?: string;  // ISO 8601 UTC
  arrivalTime?: string;    // ISO 8601 UTC
  error?: string;
};

type RouteOption = {
  name: string;
  totalDurationSeconds?: number;
  startTime?: string;      // ISO 8601 UTC - when to leave
  eta?: string;            // ISO 8601 UTC - arrival time
  segments: CommuteSegment[];
  isBest?: boolean;
  hasError?: boolean;
  leaveInMins?: number;    // Computed client-side
};

type CommuteData = {
  direction: 'toOffice' | 'toHome';
  asOf: string;            // ISO 8601 UTC
  routes: RouteOption[];
  lastUpdated: string;     // ISO 8601 UTC
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
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
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

// Helper to get traffic delay color based on minutes
function getTrafficColor(delayMins?: number): string {
  if (delayMins === undefined || delayMins <= 2) return '#34c759'; // Green - minimal delay
  if (delayMins <= 10) return '#ff9500'; // Orange - moderate delay
  return '#ff3b30'; // Red - heavy delay
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

// Format seconds to human-readable duration
function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Format ISO 8601 UTC string to local time display (e.g., "4:29 AM")
function formatTimeForDisplay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Calculate "Leave in X mins" based on route start time (ISO 8601 UTC)
function calculateLeaveInMins(route: RouteOption): number | null {
  // Use the route's startTime if available
  if (!route.startTime) {
    return null;
  }

  const startTimeUTC = new Date(route.startTime);
  const now = new Date();

  // Buffer: 5 mins for Harrison route, 2 mins otherwise
  const buffer = route.name.toLowerCase().includes('harrison') ? 5 : 2;

  // Calculate leave in mins = start time - now - buffer
  const leaveInMins = Math.round((startTimeUTC.getTime() - now.getTime()) / 60000) - buffer;

  return leaveInMins;
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [direction, setDirection] = useState<'toOffice' | 'toHome'>('toOffice');
  const [toOfficeData, setToOfficeData] = useState<CommuteData | null>(null);
  const [toHomeData, setToHomeData] = useState<CommuteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set()); // No routes expanded by default

  // Departure time selection
  const [departureMode, setDepartureMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Get current commute data based on direction
  const commuteData = direction === 'toOffice' ? toOfficeData : toHomeData;

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
  const fetchCommuteData = async (dir: 'toOffice' | 'toHome', departureTime?: Date) => {
    try {
      // Use scheduled time if provided, otherwise current time
      const asOf = (departureTime || new Date()).toISOString();
      const response = await fetch(`/api/commute?direction=${dir}&asOf=${encodeURIComponent(asOf)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const apiData = await response.json();

      // Calculate leave in mins for each route (client-side for real-time accuracy)
      const routes = apiData.routes.map((route: RouteOption) => ({
        ...route,
        leaveInMins: calculateLeaveInMins(route) ?? undefined,
      }));

      const data: CommuteData = {
        direction: dir,
        asOf: apiData.asOf,
        routes,
        lastUpdated: apiData.lastUpdated,
      };

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load commute data';
      console.error('Error fetching commute data:', err);
      throw new Error(errorMessage);
    }
  };

  // Fetch both directions
  const fetchBothDirections = async (departureTime?: Date) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both directions in parallel
      const [officeData, homeData] = await Promise.all([
        fetchCommuteData('toOffice', departureTime),
        fetchCommuteData('toHome', departureTime),
      ]);
      setToOfficeData(officeData);
      setToHomeData(homeData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load commute data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch both directions on mount
  useEffect(() => {
    fetchBothDirections();
  }, []);

  // Reset expanded routes when direction changes
  useEffect(() => {
    setExpandedRoutes(new Set());
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

        {/* Departure Time Selector */}
        <div className="departure-selector">
          <button
            className="departure-button"
            onClick={() => setShowTimePicker(!showTimePicker)}
          >
            <ClockIcon />
            <span className="departure-label">
              {departureMode === 'now' ? 'Leave Now' : scheduledTime ? scheduledTime.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }) : 'Leave Now'}
            </span>
            <ChevronIcon expanded={showTimePicker} />
          </button>

          {showTimePicker && (
            <div className="time-picker-dropdown">
              <button
                className={`time-option ${departureMode === 'now' ? 'active' : ''}`}
                onClick={() => {
                  setDepartureMode('now');
                  setScheduledTime(null);
                  setShowTimePicker(false);
                  fetchBothDirections();
                }}
              >
                Leave Now
              </button>
              <div className="time-picker-divider" />
              <div className="time-picker-inputs">
                <label className="time-picker-label">Depart at:</label>
                <input
                  type="datetime-local"
                  className="datetime-input"
                  value={scheduledTime ? new Date(scheduledTime.getTime() - scheduledTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const newTime = new Date(e.target.value);
                      setScheduledTime(newTime);
                      setDepartureMode('scheduled');
                    }
                  }}
                />
                <button
                  className="apply-time-button"
                  onClick={() => {
                    if (scheduledTime) {
                      setShowTimePicker(false);
                      fetchBothDirections(scheduledTime);
                    }
                  }}
                  disabled={!scheduledTime}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
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
            <button className="retry-button" onClick={() => fetchBothDirections(departureMode === 'scheduled' ? scheduledTime || undefined : undefined)}>
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
                  onClick={() => {
                    // Don't toggle if user is selecting text
                    const selection = window.getSelection();
                    if (selection && selection.toString().length > 0) {
                      return;
                    }
                    toggleRouteExpansion(routeIndex);
                  }}
                >
                  {/* Route Header */}
                  <div className="route-header">
                    <div className="route-name-container">
                      <div className="name-with-star">
                        {route.isBest && <span className="star-icon">★</span>}
                        <span className="route-name">{route.name}</span>
                      </div>
                      <button
                        className={`expand-button ${isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRouteExpansion(routeIndex);
                        }}
                      >
                        <ChevronIcon expanded={isExpanded} />
                      </button>
                    </div>
                    <div className="route-stats-row">
                      {route.hasError ? (
                        <span className="route-error" style={{ color: '#ff6b6b' }}>Route unavailable</span>
                      ) : (
                        <>
                          <span className="eta">ETA: {route.eta ? formatTimeForDisplay(route.eta) : '-'}</span>
                          <span className="duration">{route.totalDurationSeconds ? formatDuration(route.totalDurationSeconds) : '-'}</span>
                          <span className={`leave-time ${route.leaveInMins !== undefined ? (route.leaveInMins <= 0 ? 'urgent' : route.leaveInMins <= 5 ? 'soon' : '') : ''}`}>
                            <span className="leave-label">Leave:</span>
                            <span className="leave-value">{route.leaveInMins !== undefined ? formatLeaveTime(route.leaveInMins) : '-'}</span>
                          </span>
                        </>
                      )}
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
                              <span className="segment-mode">{getModeLabel(segment.mode)}</span>
                              <span className="separator">•</span>
                              <span className="segment-duration">{segment.duration}</span>
                              {/* Show error if present */}
                              {segment.error && (
                                <>
                                  <span className="separator">•</span>
                                  <span className="segment-error" style={{ color: '#ff6b6b' }}>{segment.error}</span>
                                </>
                              )}
                              {/* Show time range for all segments (convert ISO to local) */}
                              {!segment.error && segment.departureTime && (
                                <>
                                  <span className="separator">•</span>
                                  <span className="segment-times">
                                    {formatTimeForDisplay(segment.departureTime)}{segment.arrivalTime ? ` → ${formatTimeForDisplay(segment.arrivalTime)}` : ''}
                                  </span>
                                </>
                              )}
                              {segment.mode === 'drive' && segment.trafficDelayMins !== undefined && (
                                <>
                                  <span className="separator">•</span>
                                  <span style={{ color: getTrafficColor(segment.trafficDelayMins), fontWeight: 500 }}>
                                    {segment.trafficDelayMins > 0 ? `+${segment.trafficDelayMins}m` : 'Clear'}
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

            {/* Last Updated & Version */}
            <p className="updated-text">Updated {formatTimeForDisplay(commuteData.lastUpdated)} • v{APP_VERSION}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default App;
