import { test, expect } from '@playwright/test';

test.describe('All Commute Routes', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to force fresh data
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Commute Info")', { timeout: 10000 });
  });

  test('should display all 4 routes to office', async ({ page }) => {
    console.log('🧪 Testing TO OFFICE routes...\n');

    // Wait for routes to load
    await page.waitForSelector('.route-card', { timeout: 30000 });

    // Get all route cards
    const routeCards = page.locator('.route-card');
    const routeCount = await routeCards.count();

    console.log(`Found ${routeCount} routes`);

    // Should have exactly 4 routes (or 3 if bus not available)
    expect(routeCount).toBeGreaterThanOrEqual(3);

    // Get all route names
    const routeNames: string[] = [];
    for (let i = 0; i < routeCount; i++) {
      const routeName = await routeCards.nth(i).locator('h3').textContent();
      routeNames.push(routeName || '');
      console.log(`  Route ${i + 1}: ${routeName}`);
    }

    // Check for expected routes
    expect(routeNames).toContain('Via Harrison PATH');
    expect(routeNames).toContain('Via Hoboken Station');
    expect(routeNames).toContain('Via NY Penn Station');

    // Log if Route 4 is missing
    if (!routeNames.includes('Via Port Authority Bus')) {
      console.warn('\n⚠️  WARNING: Route 4 (Via Port Authority Bus) is missing!');
      console.warn('This could be because no bus is available at this time.\n');
    } else {
      console.log('\n✅ Route 4 (Via Port Authority Bus) is present!\n');
    }
  });

  test('should verify Route 1 (Harrison PATH) segments', async ({ page }) => {
    console.log('🧪 Testing Route 1: Via Harrison PATH\n');

    await page.waitForSelector('.route-card', { timeout: 30000 });

    // Find Route 1
    const route1 = page.locator('.route-card:has(h3:has-text("Via Harrison PATH"))').first();
    await expect(route1).toBeVisible();

    // Get segments
    const segments = route1.locator('.segment-row');
    const segmentCount = await segments.count();

    console.log(`Found ${segmentCount} segments:`);

    // Verify segment structure
    for (let i = 0; i < segmentCount; i++) {
      const segmentText = await segments.nth(i).locator('.segment-route').textContent();
      const segmentMode = await segments.nth(i).locator('.segment-details span').first().textContent();
      console.log(`  ${i + 1}. ${segmentText} (${segmentMode})`);
    }

    // Should have 4 segments: Drive, Walk, PATH, Walk
    expect(segmentCount).toBe(4);

    // Verify segment labels
    await expect(segments.nth(0).locator('.segment-route')).toContainText('Home → Harrison');
    await expect(segments.nth(1).locator('.segment-route')).toContainText('Harrison');
    await expect(segments.nth(2).locator('.segment-route')).toContainText('PATH');
    await expect(segments.nth(3).locator('.segment-route')).toContainText('Office');
  });

  test('should verify Route 4 (Port Authority Bus) segments if available', async ({ page }) => {
    console.log('🧪 Testing Route 4: Via Port Authority Bus\n');

    await page.waitForSelector('.route-card', { timeout: 30000 });

    // Check if Route 4 exists
    const route4 = page.locator('.route-card:has(h3:has-text("Via Port Authority Bus"))').first();
    const route4Exists = await route4.count() > 0;

    if (!route4Exists) {
      console.log('⚠️  Route 4 not available (no bus at this time)');
      test.skip();
      return;
    }

    console.log('✅ Route 4 is available!');

    // Get segments
    const segments = route4.locator('.segment-row');
    const segmentCount = await segments.count();

    console.log(`\nFound ${segmentCount} segments:`);

    // Print all segments
    for (let i = 0; i < segmentCount; i++) {
      const segmentRoute = await segments.nth(i).locator('.segment-route').textContent();
      const segmentDetails = await segments.nth(i).locator('.segment-details').textContent();
      console.log(`  ${i + 1}. ${segmentRoute}`);
      console.log(`     ${segmentDetails}`);
    }

    // Expected segments after consolidation:
    // 1. Home → Waterview P&R (drive)
    // 2. Waterview P&R → Bus Stop (walk)
    // 3. Waterview P&R → Port Authority (bus)
    // 4. Port Authority → Office (train) ← CONSOLIDATED!

    console.log('\n🔍 Verifying consolidated segments...');

    // Should have 4 segments (after consolidation)
    expect(segmentCount).toBe(4);

    // Verify the last segment is Port Authority → Office (consolidated)
    const lastSegment = segments.nth(segmentCount - 1);
    const lastSegmentText = await lastSegment.locator('.segment-route').textContent();
    const lastSegmentMode = await lastSegment.locator('.segment-details span').first().textContent();

    console.log(`\nLast segment: ${lastSegmentText} (${lastSegmentMode})`);

    // The last segment should be Port Authority → Office using Train
    expect(lastSegmentText).toContain('Port Authority');
    expect(lastSegmentText).toContain('Office');
    expect(lastSegmentMode).toBe('Train');

    console.log('✅ Segments are correctly consolidated!\n');
  });

  test('should verify bus schedule is being fetched', async ({ page }) => {
    console.log('🧪 Testing bus schedule fetch with FRESH data...\n');

    // Listen for console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('🚌') || text.includes('Parsed') || text.includes('Adding AM/PM') || text.includes('bus') || text.includes('Lakeland')) {
        console.log(`  ${text}`);
      }
    });

    await page.goto('http://localhost:5173');

    // Clear localStorage to force fresh fetch
    await page.evaluate(() => {
      console.log('🗑️  Clearing localStorage to force fresh schedule fetch...');
      localStorage.clear();
    });

    // Reload to fetch fresh schedule
    await page.reload();
    await page.waitForSelector('.route-card', { timeout: 60000 });

    // Wait a bit for all logs
    await page.waitForTimeout(2000);

    // Check if bus schedule logs are present
    const hasScheduleLogs = consoleLogs.some(log =>
      log.includes('🚌 Looking for') ||
      log.includes('🚌 Fetching Lakeland')
    );

    console.log(`\nBus schedule fetch detected: ${hasScheduleLogs ? '✅ YES' : '❌ NO'}`);

    if (hasScheduleLogs) {
      // Check if bus was found
      const foundBus = consoleLogs.some(log => log.includes('✅ Found bus'));
      const noBus = consoleLogs.some(log => log.includes('❌ No') && log.includes('bus'));

      if (foundBus) {
        console.log('✅ Bus schedule: Bus FOUND');
      } else if (noBus) {
        console.log('⚠️  Bus schedule: No bus available at this time');
      }

      // Find and print the schedule lookup log
      const scheduleLookup = consoleLogs.find(log => log.includes('🚌 Looking for'));
      if (scheduleLookup) {
        console.log(`\n${scheduleLookup}`);
      }

      // Find and print available times
      const availableTimes = consoleLogs.find(log => log.includes('Available times:'));
      if (availableTimes) {
        console.log(`${availableTimes}`);
      }
    }

    expect(hasScheduleLogs).toBe(true);
  });

  test('should verify all routes have segments', async ({ page }) => {
    console.log('🧪 Testing that all routes have segments...\n');

    await page.waitForSelector('.route-card', { timeout: 30000 });

    const routeCards = page.locator('.route-card');
    const routeCount = await routeCards.count();

    console.log(`Checking ${routeCount} routes:\n`);

    for (let i = 0; i < routeCount; i++) {
      const route = routeCards.nth(i);
      const routeName = await route.locator('h3').textContent();
      const segments = route.locator('.segment-row');
      const segmentCount = await segments.count();

      console.log(`${routeName}: ${segmentCount} segments`);

      // Every route should have at least 3 segments
      expect(segmentCount).toBeGreaterThanOrEqual(3);
    }

    console.log('\n✅ All routes have segments!\n');
  });

  test('should switch to home direction and verify routes', async ({ page }) => {
    console.log('🧪 Testing TO HOME routes...\n');

    await page.waitForSelector('.route-card', { timeout: 30000 });

    // Click "To Home" toggle
    const toHomeButton = page.locator('button:has-text("To Home")');
    await toHomeButton.click();

    // Wait for routes to reload
    await page.waitForTimeout(2000);
    await page.waitForSelector('.route-card');

    // Get all route cards
    const routeCards = page.locator('.route-card');
    const routeCount = await routeCards.count();

    console.log(`Found ${routeCount} routes for To Home direction`);

    // Get all route names
    for (let i = 0; i < routeCount; i++) {
      const routeName = await routeCards.nth(i).locator('h3').textContent();
      console.log(`  Route ${i + 1}: ${routeName}`);
    }

    // Should have at least 3 routes
    expect(routeCount).toBeGreaterThanOrEqual(3);

    console.log('\n✅ To Home routes loaded!\n');
  });
});
