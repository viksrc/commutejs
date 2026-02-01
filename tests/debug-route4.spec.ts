import { test } from '@playwright/test';

test('Debug Route 4 issue', async ({ page }) => {
  // Capture ALL console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5173');

  // Clear localStorage
  await page.evaluate(() => {
    console.log('Clearing localStorage...');
    localStorage.clear();
  });

  await page.reload();

  // Wait for routes
  await page.waitForSelector('.route-card', { timeout: 60000 });

  // Count routes
  const count = await page.locator('.route-card').count();
  console.log(`\n=== FOUND ${count} ROUTES ===\n`);

  // Get all route names
  for (let i = 0; i < count; i++) {
    const name = await page.locator('.route-card').nth(i).locator('.route-name').textContent();
    console.log(`Route ${i+1}: ${name}`);
  }

  // Check for Route 4
  const route4 = page.locator('.route-card').filter({ hasText: 'Port Authority Bus' });
  const hasRoute4 = await route4.count() > 0;
  console.log(`\nVia Port Authority Bus present: ${hasRoute4 ? 'YES ✅' : 'NO ❌'}`);

  // Take screenshot
  await page.screenshot({ path: '/tmp/routes-debug.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/routes-debug.png');
});
