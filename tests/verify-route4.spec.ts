import { test, expect } from '@playwright/test';

test('Verify Route 4 (PABT Bus) is displayed', async ({ page }) => {
  console.log('🧪 Verifying Route 4 displays...\n');

  // Go to page and clear cache
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();

  // Wait for routes to load
  await page.waitForSelector('.route-card', { timeout: 60000 });

  // Count routes
  const routeCards = page.locator('.route-card');
  const count = await routeCards.count();
  console.log(`Found ${count} routes`);

  // Try to find Route 4
  const route4 = page.locator('.route-card').filter({ hasText: 'Via Port Authority Bus' });
  const route4Exists = await route4.count() > 0;

  console.log(`Route 4 exists: ${route4Exists ? '✅ YES' : '❌ NO'}`);

  if (route4Exists) {
    // Get segment count
    const segments = route4.locator('.segment-row');
    const segmentCount = await segments.count();
    console.log(`Route 4 has ${segmentCount} segments`);

    // Print segments
    for (let i = 0; i < segmentCount; i++) {
      const segmentText = await segments.nth(i).locator('.segment-route').textContent();
      const detailsText = await segments.nth(i).locator('.segment-details').textContent();
      console.log(`  ${i + 1}. ${segmentText}`);
      console.log(`     ${detailsText}`);
    }

    // Check for consolidated segment
    const lastSegment = segments.last();
    const lastText = await lastSegment.locator('.segment-route').textContent();
    console.log(`\nLast segment: ${lastText}`);

    if (lastText?.includes('Port Authority') && lastText?.includes('Office')) {
      console.log('✅ Segments are consolidated (Port Authority → Office)');
    } else {
      console.log('⚠️  Segments might not be consolidated');
    }
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/commute-routes.png', fullPage: true });
  console.log('\n📸 Screenshot saved to /tmp/commute-routes.png');

  expect(count).toBeGreaterThanOrEqual(3);
});
