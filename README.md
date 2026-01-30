# CommuteInfo Web

A React web application showing real-time commute times from Morris Plains, NJ to 200 West St, NYC via 4 different multi-modal routes.

## Features

- **4 Route Options**: Harrison PATH, Morris Plains Train, NY Penn Station, Port Authority Bus
- **Bidirectional**: Toggle between "To Office" and "To Home"
- **Real-time Data**: Live traffic and transit information via Google Maps API
- **Traffic Status**: Visual indicators for traffic conditions
- **ETA Calculations**: Estimated arrival times for each route
- **Best Route Highlighting**: Automatically identifies the fastest route
- **Dark Mode**: Automatically adapts to system preferences
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Expandable Cards**: Click to see detailed route segments

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS Variables** - Dark mode support
- **Google Maps Routes API v2** - Real-time directions

## Getting Started

### Prerequisites

- Node.js v20 or higher
- Google Maps API key with Routes API enabled

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at http://localhost:5173

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
commutejs/
├── src/
│   ├── App.tsx              # Main React component
│   ├── App.css              # Styles with dark mode
│   ├── main.tsx             # React entry point
│   ├── config/
│   │   └── locations.ts     # 8 location definitions
│   └── services/
│       └── googleMapsService.ts  # Google Maps API integration
├── index.html               # HTML entry point
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite config
```

## Routes

### To Office

1. **Via Harrison PATH** - Drive to Harrison → PATH to WTC → Walk
2. **Via Morris Plains Train** - Drive to station → Train to Hoboken → PATH to WTC → Walk
3. **Via NY Penn Station** - Drive to station → Train to Penn → Subway to WTC → Walk
4. **Via Port Authority Bus** - Drive to P&R → Bus to PABT → Subway to WTC → Walk

### To Home

All routes in reverse direction.

## API Key

The Google Maps API key is located in `src/services/googleMapsService.ts:10`. Make sure the Routes API is enabled in your Google Cloud Console.

## Features Comparison

| Feature | React Native | React Web |
|---------|-------------|-----------|
| Platform | iOS/Android | Browser |
| Refresh | Pull gesture | Button |
| Icons | MaterialCommunityIcons | Unicode emoji |
| Dark Mode | System hook | CSS media query |
| Maps | Deep link to app | Open in new tab |

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Private project
