import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing schedule ID' });
  }

  // Validate schedule ID (only allow expected values)
  const validIds = ['25', '26', '28', '32'];
  if (!validIds.includes(id)) {
    return res.status(400).json({ error: 'Invalid schedule ID' });
  }

  try {
    const lakelandUrl = `https://www.lakelandbus.com/wp-admin/admin-ajax.php?action=schedule&id=${id}`;

    const response = await fetch(lakelandUrl, {
      headers: {
        'User-Agent': 'CommuteJS/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Lakeland Bus API error: ${response.status}`);
      return res.status(response.status).json({
        error: 'Failed to fetch from Lakeland Bus'
      });
    }

    const html = await response.text();

    // Return as text with appropriate content type
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error proxying Lakeland Bus request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
