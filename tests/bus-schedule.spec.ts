import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://commutejs.vercel.app';

test.describe('Lakeland Bus Schedule Parsing', () => {
  test('should parse and display Route 4 (Port Authority Bus)', async ({ page }) => {
    // Set up console logging
    const logs: string[] = [];
    const warnings: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'log') {
        logs.push(text);
      } else if (msg.type() === 'warning') {
        warnings.push(text);
      }
    });

    // Clear cache and reload
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for routes to load
    await page.waitForTimeout(8000);

    // Check for bus schedule warnings
    const hasBusWarning = warnings.some(w =>
      w.includes('No Lakeland bus available')
    );

    if (hasBusWarning) {
      console.log('⚠️ Bus schedule warning found:',
        warnings.filter(w => w.includes('Lakeland')));

      // Look for parsing logs
      const parsingLogs = logs.filter(l =>
        l.includes('Available stops') ||
        l.includes('Looking for stop') ||
        l.includes('Found') && l.includes('rows')
      );
      console.log('Parsing logs:', parsingLogs);
    }

    // Check if Route 4 is present
    const routeCards = page.locator('.route-card');
    const count = await routeCards.count();
    console.log(`Route count: ${count}`);

    // Get route names
    for (let i = 0; i < count; i++) {
      const routeName = await routeCards.nth(i).locator('.route-name').textContent();
      console.log(`Route ${i + 1}: ${routeName}`);
    }

    // Should have 4 routes including Port Authority
    expect(count).toBe(4);

    // Verify Port Authority route exists
    const portAuthorityRoute = page.locator('.route-name:has-text("Port Authority")');
    await expect(portAuthorityRoute).toBeVisible();
  });

  test('should successfully fetch and parse bus schedules', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForTimeout(8000);

    // Should see schedule fetch
    const hasFetch = logs.some(l => l.includes('🚌 Fetching Lakeland Bus schedules'));
    expect(hasFetch).toBeTruthy();

    // Should see success
    const hasSuccess = logs.some(l => l.includes('✅ Lakeland Bus schedules fetched successfully'));
    expect(hasSuccess).toBeTruthy();

    // Should see parsing logs
    const hasParsingLogs = logs.some(l =>
      l.includes('Available stops') || l.includes('Looking for stop')
    );

    if (!hasParsingLogs) {
      console.log('❌ No parsing logs found!');
      console.log('All logs:', logs.filter(l => l.includes('Lakeland')));
    }

    expect(hasParsingLogs).toBeTruthy();
  });
});
