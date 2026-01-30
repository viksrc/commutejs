import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://commutejs.vercel.app';

test.describe('CommuteJS App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check title
    await expect(page).toHaveTitle(/CommuteInfo/);

    // Check header (has space in it)
    await expect(page.locator('h1')).toContainText('Commute');
  });

  test('should have Google Maps API key loaded', async ({ page }) => {
    // Set up console listener before navigation
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });

    await page.goto(BASE_URL);

    // Wait for API key check
    await page.waitForTimeout(3000);

    // Should see API key present log
    const hasApiKeyLog = logs.some(log =>
      log.includes('Google Maps API Key present: true')
    );
    expect(hasApiKeyLog).toBeTruthy();
  });

  test('should fetch Google Maps routes', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'log') {
        consoleLogs.push(text);
      } else if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    await page.goto(BASE_URL);

    // Wait for routes to load
    await page.waitForTimeout(5000);

    // Should see driving route fetches
    const hasDrivingFetch = consoleLogs.some(log =>
      log.includes('🚗 Fetching driving directions')
    );
    expect(hasDrivingFetch).toBeTruthy();

    // Should see transit route fetches
    const hasTransitFetch = consoleLogs.some(log =>
      log.includes('🚇 Fetching transit directions')
    );
    expect(hasTransitFetch).toBeTruthy();

    // Should see success messages
    const hasSuccess = consoleLogs.some(log =>
      log.includes('✅ Driving route found') || log.includes('✅ Transit route found')
    );
    expect(hasSuccess).toBeTruthy();

    // Should not have API key errors
    const hasApiKeyError = consoleErrors.some(err =>
      err.includes('API_KEY_HTTP_REFERRER_BLOCKED')
    );
    expect(hasApiKeyError).toBeFalsy();
  });

  test('should fetch Lakeland Bus schedules', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    // Clear localStorage to force fresh fetch
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for schedules to load
    await page.waitForTimeout(5000);

    // Should see bus schedule fetch
    const hasBusFetch = consoleLogs.some(log =>
      log.includes('🚌 Fetching Lakeland Bus schedules')
    );
    expect(hasBusFetch).toBeTruthy();

    // Should see success
    const hasBusSuccess = consoleLogs.some(log =>
      log.includes('✅ Lakeland Bus schedules fetched successfully')
    );
    expect(hasBusSuccess).toBeTruthy();
  });

  test('should display route cards on the page', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for routes to load
    await page.waitForTimeout(8000);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/route-cards.png', fullPage: true });

    // Check for route cards
    const routeCards = page.locator('.route-card');
    const count = await routeCards.count();

    console.log(`Found ${count} route cards`);
    expect(count).toBeGreaterThan(0);

    // Check that at least one route shows ETA
    const etaText = await page.locator('.eta').first().textContent();
    console.log('ETA text:', etaText);
    expect(etaText).toContain('ETA');
  });

  test('should display route details when expanded', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for routes to load
    await page.waitForTimeout(8000);

    // Find the first route card (should be expanded by default)
    const firstRoute = page.locator('.route-card').first();

    // Check if segments are visible
    const segments = firstRoute.locator('.segment-row');
    const segmentCount = await segments.count();

    console.log(`Found ${segmentCount} segments in first route`);
    expect(segmentCount).toBeGreaterThan(0);

    // Check segment content
    const firstSegment = await segments.first().textContent();
    console.log('First segment:', firstSegment);
    expect(firstSegment).toBeTruthy();
  });
});
