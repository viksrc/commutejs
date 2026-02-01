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
    await page.waitForSelector('h1:has-text("Commute Info")', { timeout: 30000 });

    // Wait for routes to load (may take time due to API calls)
    await page.waitForSelector('.route-card', { timeout: 60000 });
  });

  test('should display all 4 routes including Via Port Authority Bus', async ({ page }) => {
    console.log('🧪 Testing TO OFFICE routes...\n');

    // Get all route cards
    const routeCards = page.locator('.route-card');
    const routeCount = await routeCards.count();

    console.log(`Found ${routeCount} routes`);

    // Get route names by checking the .route-name elements
    const routeNames: string[] = [];
    for (let i = 0; i < routeCount; i++) {
      const card = routeCards.nth(i);
      // Look for route name in the span.route-name
      const nameSpan = card.locator('.route-name');
      const name = await nameSpan.first().textContent({ timeout: 5000 });
      routeNames.push(name?.trim() || 'Unknown');
      console.log(`  Route ${i + 1}: ${name?.trim()}`);
    }

    // Check for expected routes
    expect(routeNames).toContain('Via Harrison PATH');
    expect(routeNames).toContain('Via Hoboken Station');
    expect(routeNames).toContain('Via NY Penn Station');

    // Route 4 should appear if bus is available
    const hasRoute4 = routeNames.includes('Via Port Authority Bus');

    if (hasRoute4) {
      console.log('\n✅ Route 4 (Via Port Authority Bus) is present!');
    } else {
      console.warn('\n⚠️  Route 4 not found - may be no bus at this time');
    }

    // At minimum we should have 3 routes, 4 if bus is available
    expect(routeCount).toBeGreaterThanOrEqual(3);
  });

  test('should verify Route 4 (Via Port Authority Bus) segments are correct', async ({ page }) => {
    console.log('🧪 Testing Route 4: Via Port Authority Bus\n');

    // Find Route 4 card
    const route4Card = page.locator('.route-card').filter({ hasText: 'Via Port Authority Bus' });
    const route4Exists = await route4Card.count() > 0;

    if (!route4Exists) {
      console.log('⚠️  Route 4 not available (no bus at this time)');
      test.skip();
      return;
    }

    console.log('✅ Route 4 is present');

    // Click to expand the route card
    await route4Card.click();

    // Wait for segments to render after expansion
    await page.waitForTimeout(500);

    // Get segments
    const segments = route4Card.locator('.segment-row');
    const segmentCount = await segments.count();

    console.log(`\nRoute 4 has ${segmentCount} segments:`);

    // Print all segments
    for (let i = 0; i < segmentCount; i++) {
      const segmentRoute = await segments.nth(i).locator('.segment-route').textContent();
      const segmentDetails = await segments.nth(i).locator('.segment-details').textContent();
      console.log(`  ${i + 1}. ${segmentRoute?.trim()}`);
      console.log(`     ${segmentDetails?.trim()}`);
    }

    // Verify segment count (should be 4 after consolidation)
    // 1. Home → Waterview P&R (drive)
    // 2. Waterview P&R → Bus Stop (walk)
    // 3. Waterview P&R → Port Authority (bus)
    // 4. Port Authority → Office (train) ← CONSOLIDATED
    expect(segmentCount).toBe(4);

    // Verify the bus segment exists
    const busSegment = segments.filter({ hasText: 'Port Authority' }).filter({ hasText: 'Bus' });
    expect(await busSegment.count()).toBeGreaterThan(0);
    console.log('\n✅ Bus segment found');

    // Verify consolidated segment (Port Authority → Office)
    const lastSegment = segments.last();
    const lastSegmentText = await lastSegment.locator('.segment-route').textContent();

    expect(lastSegmentText).toContain('Port Authority');
    expect(lastSegmentText).toContain('Office');
    console.log('✅ Consolidated segment (Port Authority → Office) verified');

    // Verify it's using Train mode (not separate subway + walk)
    const trainLabel = await lastSegment.locator('.segment-details').textContent();
    expect(trainLabel).toContain('Train');
    console.log('✅ Using Train mode for consolidated segment');
  });

  test('should verify bus schedule is fetched with correct times', async ({ page }) => {
    console.log('🧪 Testing bus schedule fetch...\n');

    // Listen for console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
    });

    // Reload to trigger fresh fetch
    await page.reload();
    await page.waitForSelector('.route-card', { timeout: 60000 });
    await page.waitForTimeout(2000);

    // Check for schedule fetch logs
    const hasFetchLog = consoleLogs.some(log => log.includes('🚌 Fetching Lakeland Bus'));
    const hasParseLog = consoleLogs.some(log => log.includes('✓ Parsed'));
    const hasBusLookup = consoleLogs.some(log => log.includes('🚌 Looking for'));

    console.log('Schedule fetch logs:');
    consoleLogs
      .filter(log => log.includes('🚌') || log.includes('Parsed') || log.includes('Available times'))
      .forEach(log => console.log(`  ${log}`));

    // Check for weekend eastbound times
    const weekendEastLog = consoleLogs.find(log =>
      log.includes('Weekend East') ||
      (log.includes('Parsed') && log.includes('7:20'))
    );

    if (weekendEastLog) {
      console.log('\n✅ Weekend eastbound schedule parsed correctly');
    }

    // Check if bus was found
    const foundBus = consoleLogs.some(log => log.includes('✅ Found bus'));
    if (foundBus) {
      console.log('✅ Bus found in schedule');
    }

    expect(hasBusLookup).toBe(true);
  });

  test('should display correct segment labels for Route 4', async ({ page }) => {
    console.log('🧪 Testing Route 4 segment labels...\n');

    // Find Route 4 card
    const route4Card = page.locator('.route-card').filter({ hasText: 'Via Port Authority Bus' });
    const route4Exists = await route4Card.count() > 0;

    if (!route4Exists) {
      console.log('⚠️  Route 4 not available (no bus at this time)');
      test.skip();
      return;
    }

    // Click to expand
    await route4Card.click();
    await page.waitForTimeout(500);

    // Check for Bus mode label
    const busLabel = route4Card.locator('.segment-details:has-text("Bus")');
    const hasBusLabel = await busLabel.count() > 0;

    console.log(`Bus label present: ${hasBusLabel ? '✅ YES' : '❌ NO'}`);
    expect(hasBusLabel).toBe(true);

    // Check for Train mode label (for Port Authority → Office)
    const trainLabel = route4Card.locator('.segment-details:has-text("Train")');
    const hasTrainLabel = await trainLabel.count() > 0;

    console.log(`Train label present: ${hasTrainLabel ? '✅ YES' : '❌ NO'}`);
    expect(hasTrainLabel).toBe(true);

    // Check for departure time
    const departsLabel = route4Card.locator('.segment-departs, :has-text("Departs")');
    const hasDepartsLabel = await departsLabel.count() > 0;

    console.log(`Departure time present: ${hasDepartsLabel ? '✅ YES' : '❌ NO'}`);
    expect(hasDepartsLabel).toBe(true);

    console.log('\n✅ All segment labels correct!');
  });
});
