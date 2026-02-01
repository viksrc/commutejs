import type { VercelRequest, VercelResponse } from '@vercel/node';
import { JSDOM } from 'jsdom';

// Types for the schedule
interface BusSchedule {
  eastbound: string[];
  westbound: string[];
}

interface CachedScheduleData {
  timestamp: number;
  fetchedAt: string;
  schedules: {
    weekday: BusSchedule;
    weekend: BusSchedule;
  };
}

const SCHEDULE_IDS = {
  weekdayEastbound: '25',
  weekdayWestbound: '32',
  weekendEastbound: '26',
  weekendWestbound: '28',
};

// In-memory cache (local dev)
let serverCache: { data: CachedScheduleData | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Parse schedule HTML to extract times for a specific stop
 */
function parseScheduleHTML(html: string, stopName: string): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const rows = Array.from(doc.querySelectorAll('tr.stop-schedule'));
  const stopRow = rows.find(row => {
    const nameDiv = row.querySelector('.s-name');
    return nameDiv && nameDiv.textContent?.includes(stopName);
  });

  if (!stopRow) return [];

  const times: string[] = [];
  const timeCells = stopRow.querySelectorAll('td .s-time span');

  timeCells.forEach(span => {
    const time = span.textContent?.trim();
    if (time && time !== '-') {
      times.push(time);
    }
  });

  return times;
}

/**
 * Add AM/PM to times based on schedule context
 */
function addAmPm(times: string[], direction: 'eastbound' | 'westbound', isWeekend: boolean): string[] {
  return times.map(time => {
    const [hourStr] = time.split(':');
    const hour = parseInt(hourStr, 10);

    let isAM = false;

    if (direction === 'eastbound') {
      if (isWeekend) {
        isAM = hour >= 7 && hour < 12;
      } else {
        isAM = hour >= 4 && hour <= 12;
      }
    } else {
      if (isWeekend) {
        // Weekend Westbound fix: 9 AM and 11 AM are AM, others are PM
        isAM = hour === 9 || hour === 11;
      } else {
        isAM = hour >= 7 && hour < 12;
      }
    }

    return `${time} ${isAM ? 'AM' : 'PM'}`;
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check cache
  const now = Date.now();
  if (serverCache.data && (now - serverCache.timestamp < CACHE_TTL)) {
    console.log('📦 Returning cached schedule from backend');
    return res.status(200).json(serverCache.data);
  }

  try {
    console.log('🚌 Fetching fresh Lakeland Bus schedules...');
    const fetchHTML = async (id: string) => {
      const resp = await fetch(`https://www.lakelandbus.com/wp-admin/admin-ajax.php?action=schedule&id=${id}`, {
        headers: { 'User-Agent': 'CommuteJS/1.0' },
      });
      return resp.text();
    };

    const [weekdayEastHTML, weekdayWestHTML, weekendEastHTML, weekendWestHTML] = await Promise.all([
      fetchHTML(SCHEDULE_IDS.weekdayEastbound),
      fetchHTML(SCHEDULE_IDS.weekdayWestbound),
      fetchHTML(SCHEDULE_IDS.weekendEastbound),
      fetchHTML(SCHEDULE_IDS.weekendWestbound),
    ]);

    const weekdayEastTimes = parseScheduleHTML(weekdayEastHTML, 'Parsippany (Waterview P&R)');
    const weekdayWestTimes = parseScheduleHTML(weekdayWestHTML, 'NY PABT');
    const weekendEastTimes = parseScheduleHTML(weekendEastHTML, 'Parsippany (Waterview P&R)');
    const weekendWestTimes = parseScheduleHTML(weekendWestHTML, 'Depart New York PABT');

    const scheduleData: CachedScheduleData = {
      timestamp: now,
      fetchedAt: new Date().toISOString(),
      schedules: {
        weekday: {
          eastbound: addAmPm(weekdayEastTimes, 'eastbound', false),
          westbound: addAmPm(weekdayWestTimes, 'westbound', false),
        },
        weekend: {
          eastbound: addAmPm(weekendEastTimes, 'eastbound', true),
          westbound: addAmPm(weekendWestTimes, 'westbound', true),
        },
      },
    };

    // Update cache
    serverCache = {
      data: scheduleData,
      timestamp: now,
    };

    res.status(200).json(scheduleData);
  } catch (error) {
    console.error('Error processing Lakeland Bus schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
