/**
 * Commute Configuration
 * Your home, office, and PATH station locations
 */

export const LOCATIONS = {
  home: {
    name: 'Home',
    shortName: 'Home',
    address: '411 Mountainway, Morris Plains, NJ',
    coords: {
      latitude: 40.8343,
      longitude: -74.4815,
    },
  },
  harrisonParking: {
    name: 'Harrison Parking',
    shortName: 'Harrison P',
    address: 'Guyon St Parking Lot, Harrison, NJ',
    coords: {
      latitude: 40.7394,
      longitude: -74.1559,
    },
  },
  harrisonPath: {
    name: 'Harrison PATH',
    shortName: 'Harrison',
    address: 'Harrison PATH Station, Harrison, NJ',
    coords: {
      latitude: 40.7392,
      longitude: -74.1556,
    },
  },
  morrisPlainsStation: {
    name: 'Morris Plains Station',
    shortName: 'Morris Plains',
    address: 'Morris Plains Station, Morris Plains, NJ',
    coords: {
      latitude: 40.8371,
      longitude: -74.4816,
    },
  },
  hobokenStation: {
    name: 'Hoboken Terminal',
    shortName: 'Hoboken',
    address: 'Hoboken Terminal, Hoboken, NJ',
    coords: {
      latitude: 40.7357,
      longitude: -74.0293,
    },
  },
  nyPennStation: {
    name: 'NY Penn Station',
    shortName: 'Penn Station',
    address: 'Pennsylvania Station, New York, NY',
    coords: {
      latitude: 40.7505,
      longitude: -73.9934,
    },
  },
  waterviewParkRide: {
    name: 'Waterview Blvd Park & Ride',
    shortName: 'Waterview P&R',
    address: 'Waterview Blvd Park and Ride, Parsippany, NJ',
    coords: {
      latitude: 40.8577,
      longitude: -74.4194,
    },
  },
  portAuthority: {
    name: 'Port Authority Bus Terminal',
    shortName: 'Port Authority',
    address: '625 8th Ave, New York, NY',
    coords: {
      latitude: 40.7570,
      longitude: -73.9900,
    },
  },
  wtcPath: {
    name: 'WTC PATH',
    shortName: 'WTC PATH',
    address: 'World Trade Center PATH Station, New York, NY',
    coords: {
      latitude: 40.7127,
      longitude: -74.0099,
    },
  },
  office: {
    name: 'Office',
    shortName: 'Office',
    address: '200 West St, New York, NY',
    coords: {
      latitude: 40.7133,
      longitude: -74.0158,
    },
  },
};

export type LocationKey = keyof typeof LOCATIONS;
