import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSchedule } from './services/lakelandBus.js';

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

  try {
    const data = await getSchedule();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error processing Lakeland Bus schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
