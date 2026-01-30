import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://commutejs.vercel.app';

test.describe('Lakeland Bus API', () => {
  test('should return 400 for missing schedule ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus`);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing schedule ID');
  });

  test('should return 400 for invalid schedule ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus?id=999`);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid schedule ID');
  });

  test('should fetch weekday eastbound schedule (ID 25)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus?id=25`);

    expect(response.status()).toBe(200);
    const html = await response.text();

    // Check for expected content
    expect(html).toContain('Parsippany (Waterview P&R)');
    expect(html).toContain('NYPABT');
    expect(html.length).toBeGreaterThan(1000);
  });

  test('should fetch weekday westbound schedule (ID 32)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus?id=32`);

    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('NY PABT');
    expect(html.length).toBeGreaterThan(1000);
  });

  test('should fetch weekend eastbound schedule (ID 26)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus?id=26`);

    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('Parsippany');
    expect(html.length).toBeGreaterThan(500);
  });

  test('should fetch weekend westbound schedule (ID 28)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/lakeland-bus?id=28`);

    expect(response.status()).toBe(200);
    const html = await response.text();

    // Weekend schedule uses different stop name
    expect(html).toContain('LEAVES FROM GATE');
    expect(html.length).toBeGreaterThan(500);
  });
});
