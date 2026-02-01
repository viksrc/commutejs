export interface CommuteSegment {
    mode: 'drive' | 'walk' | 'train' | 'path' | 'bus';
    from: string;
    to: string;
    fromLabel?: string; // Optional for now, but good for UI
    toLabel?: string;
    duration: string;
    distance?: string;
    traffic?: string;
    departureTime?: string; // "8:00 AM"
    arrivalTime?: string;   // "8:30 AM"
}

export interface RouteOption {
    name: string;
    totalTime: string; // e.g., "1h 15m"
    eta: string;       // e.g., "9:30 AM"
    leaveInMins?: number | null;
    isBest?: boolean;
    segments: CommuteSegment[];
}

export interface CommuteResponse {
    direction: 'toOffice' | 'toHome';
    lastUpdated: string;
    routes: RouteOption[];
}
