/**
 * Route Configurations
 * Define commute routes as config - App.tsx iterates over these
 */

import { LocationKey } from './locations';

// Segment types for route configuration
export type SegmentConfig =
  | { type: 'drive'; from: LocationKey; to: LocationKey; fromLabel: string; toLabel: string }
  | { type: 'walk'; fromLabel: string; toLabel: string; duration: string }
  | { type: 'transit'; from: LocationKey; to: LocationKey; fromLabel: string; toLabel: string; mode: 'train' | 'path' }
  | { type: 'bus'; direction: 'eastbound' | 'westbound'; from: LocationKey; to: LocationKey; fromLabel: string; toLabel: string };

export type RouteConfig = {
  name: string;
  segments: SegmentConfig[];
};

export const ROUTES_CONFIG: {
  toOffice: RouteConfig[];
  toHome: RouteConfig[];
} = {
  toOffice: [
    // Route 1: Via Harrison PATH
    {
      name: 'Via Harrison PATH',
      segments: [
        { type: 'drive', from: 'home', to: 'harrisonParking', fromLabel: 'Home', toLabel: 'Harrison P' },
        { type: 'walk', fromLabel: 'Harrison P', toLabel: 'Harrison PATH', duration: '5m' },
        { type: 'transit', from: 'harrisonPath', to: 'wtcPath', fromLabel: 'Harrison', toLabel: 'WTC PATH', mode: 'path' },
        { type: 'walk', fromLabel: 'WTC PATH', toLabel: 'Office', duration: '5m' },
      ],
    },
    // Route 2: Via Hoboken Station
    {
      name: 'Via Hoboken Station',
      segments: [
        { type: 'drive', from: 'home', to: 'morrisPlainsStation', fromLabel: 'Home', toLabel: 'Morris Plains' },
        { type: 'walk', fromLabel: 'Morris Plains', toLabel: 'Parking', duration: '3m' },
        { type: 'transit', from: 'morrisPlainsStation', to: 'hobokenStation', fromLabel: 'Morris Plains', toLabel: 'Hoboken', mode: 'train' },
        { type: 'transit', from: 'hobokenStation', to: 'office', fromLabel: 'Hoboken', toLabel: 'Office', mode: 'path' },
      ],
    },
    // Route 3: Via NY Penn Station
    {
      name: 'Via NY Penn Station',
      segments: [
        { type: 'drive', from: 'home', to: 'morrisPlainsStation', fromLabel: 'Home', toLabel: 'Morris Plains' },
        { type: 'walk', fromLabel: 'Morris Plains', toLabel: 'Parking', duration: '3m' },
        { type: 'transit', from: 'morrisPlainsStation', to: 'nyPennStation', fromLabel: 'Morris Plains', toLabel: 'Penn Station', mode: 'train' },
        { type: 'transit', from: 'nyPennStation', to: 'office', fromLabel: 'Penn Station', toLabel: 'Office', mode: 'train' },
      ],
    },
    // Route 4: Via Port Authority Bus
    {
      name: 'Via Port Authority Bus',
      segments: [
        { type: 'drive', from: 'home', to: 'waterviewParkRide', fromLabel: 'Home', toLabel: 'Waterview P&R' },
        { type: 'walk', fromLabel: 'Waterview P&R', toLabel: 'Bus Stop', duration: '3m' },
        { type: 'bus', direction: 'eastbound', from: 'waterviewParkRide', to: 'portAuthority', fromLabel: 'Waterview P&R', toLabel: 'Port Authority' },
        { type: 'transit', from: 'portAuthority', to: 'office', fromLabel: 'Port Authority', toLabel: 'Office', mode: 'train' },
      ],
    },
  ],
  toHome: [
    // Route 1: Via Harrison PATH
    {
      name: 'Via Harrison PATH',
      segments: [
        { type: 'walk', fromLabel: 'Office', toLabel: 'WTC PATH', duration: '5m' },
        { type: 'transit', from: 'wtcPath', to: 'harrisonPath', fromLabel: 'WTC PATH', toLabel: 'Harrison', mode: 'path' },
        { type: 'walk', fromLabel: 'Harrison PATH', toLabel: 'Harrison P', duration: '5m' },
        { type: 'drive', from: 'harrisonParking', to: 'home', fromLabel: 'Harrison P', toLabel: 'Home' },
      ],
    },
    // Route 2: Via Hoboken Station
    {
      name: 'Via Hoboken Station',
      segments: [
        { type: 'transit', from: 'office', to: 'hobokenStation', fromLabel: 'Office', toLabel: 'Hoboken', mode: 'path' },
        { type: 'transit', from: 'hobokenStation', to: 'morrisPlainsStation', fromLabel: 'Hoboken', toLabel: 'Morris Plains', mode: 'train' },
        { type: 'walk', fromLabel: 'Parking', toLabel: 'Morris Plains', duration: '3m' },
        { type: 'drive', from: 'morrisPlainsStation', to: 'home', fromLabel: 'Morris Plains', toLabel: 'Home' },
      ],
    },
    // Route 3: Via NY Penn Station
    {
      name: 'Via NY Penn Station',
      segments: [
        { type: 'transit', from: 'office', to: 'nyPennStation', fromLabel: 'Office', toLabel: 'Penn Station', mode: 'train' },
        { type: 'transit', from: 'nyPennStation', to: 'morrisPlainsStation', fromLabel: 'NY Penn', toLabel: 'Morris Plains', mode: 'train' },
        { type: 'walk', fromLabel: 'Parking', toLabel: 'Morris Plains', duration: '3m' },
        { type: 'drive', from: 'morrisPlainsStation', to: 'home', fromLabel: 'Morris Plains', toLabel: 'Home' },
      ],
    },
    // Route 4: Via Port Authority Bus
    {
      name: 'Via Port Authority Bus',
      segments: [
        { type: 'transit', from: 'office', to: 'portAuthority', fromLabel: 'Office', toLabel: 'Port Authority', mode: 'train' },
        { type: 'bus', direction: 'westbound', from: 'portAuthority', to: 'waterviewParkRide', fromLabel: 'Port Authority', toLabel: 'Waterview P&R' },
        { type: 'walk', fromLabel: 'Bus Stop', toLabel: 'Waterview P&R', duration: '3m' },
        { type: 'drive', from: 'waterviewParkRide', to: 'home', fromLabel: 'Waterview P&R', toLabel: 'Home' },
      ],
    },
  ],
};
