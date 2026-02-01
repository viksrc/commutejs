import { test } from '@playwright/test';

test('Check localStorage cache WITHOUT clearing', async ({ page }) => {
  // Go to page WITHOUT clearing localStorage
  await page.goto('http://localhost:5173');

  // Check what's in localStorage
  const cacheData = await page.evaluate(() => {
    const cache = localStorage.getItem('lakeland-bus-route46-schedule');
    if (!cache) return 'NO CACHE';
    const parsed = JSON.parse(cache);
    return {
      weekendEastbound: parsed.data?.schedules?.weekend?.eastbound || [],
      weekendWestbound: parsed.data?.schedules?.weekend?.westbound || [],
      fetchedAt: parsed.data?.fetchedAt
    };
  });

  console.log('\n=== CURRENT CACHE STATE ===');
  console.log(JSON.stringify(cacheData, null, 2));

  // Wait for routes
  await page.waitForSelector('.route-card', { timeout: 60000 });

  // Count routes
  const count = await page.locator('.route-card').count();
  console.log(`\nRoutes displayed: ${count}`);

  for (let i = 0; i < count; i++) {
    const name = await page.locator('.route-card').nth(i).locator('.route-name').textContent();
    console.log(`  ${i+1}. ${name}`);
  }

  const hasRoute4 = await page.locator('.route-card').filter({ hasText: 'Port Authority Bus' }).count() > 0;
  console.log(`\nVia Port Authority Bus: ${hasRoute4 ? '✅ YES' : '❌ NO'}`);
});
