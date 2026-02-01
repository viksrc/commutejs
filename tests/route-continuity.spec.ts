import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';

/**
 * Helper to parse "HH:MM AM/PM" into minutes since midnight
 */
function parseTime(timeStr: string): number {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return -1;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
}

/**
 * Helper to parse duration like "35m" or "1h 5m" into minutes
 */
function parseDuration(durationStr: string): number {
    const hMatch = durationStr.match(/(\d+)h/);
    const mMatch = durationStr.match(/(\d+)m/);
    let total = 0;
    if (hMatch) total += parseInt(hMatch[1], 10) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);
    return total;
}

test.describe('Route Continuity Verification', () => {
    test('should verify each segment starts after the previous one finishes', async ({ page }) => {
        // Increase timeout for route fetching
        test.setTimeout(60000);

        await page.goto(BASE_URL);
        await page.waitForSelector('.route-card');

        const directions = ['toOffice', 'toHome'];

        for (const dir of directions) {
            console.log(`Checking direction: ${dir}`);

            if (dir === 'toHome') {
                const toHomeBtn = page.locator('button:has-text("To Home")');
                await toHomeBtn.click();
                await page.waitForTimeout(2000); // Wait for routes to refresh
            }

            const routeCards = page.locator('.route-card');
            const routeCount = await routeCards.count();

            for (let i = 0; i < routeCount; i++) {
                const routeCard = routeCards.nth(i);
                const routeName = await routeCard.locator('.route-name').textContent();
                console.log(`  Verifying route: ${routeName}`);

                // Expand if not already expanded
                const isExpanded = await routeCard.locator('.segments-container').isVisible();
                if (!isExpanded) {
                    await routeCard.click();
                    await expect(routeCard.locator('.segments-container')).toBeVisible();
                }

                const segments = routeCard.locator('.segment-row');
                const segmentCount = await segments.count();

                // Track the "clock" for the route
                let currentArrivalTime: number | null = null;

                for (let j = 0; j < segmentCount; j++) {
                    const segment = segments.nth(j);
                    const segmentDetails = await segment.locator('.segment-details').textContent();
                    const durationStr = await segment.locator('.segment-details span').nth(2).textContent() || '0m';
                    const duration = parseDuration(durationStr);

                    // Check for explicit times "Departs -> Arrives"
                    const timesSpan = segment.locator('.segment-times');
                    const hasTimes = await timesSpan.isVisible();

                    if (hasTimes) {
                        const timesText = await timesSpan.textContent(); // e.g. "10:30 AM → 11:05 AM"
                        const [depStr, arrStr] = timesText!.split('→').map(s => s.trim());

                        const depTime = parseTime(depStr);
                        const arrTime = parseTime(arrStr);

                        console.log(`    Segment ${j}: ${depStr} → ${arrStr} (${durationStr})`);

                        if (currentArrivalTime !== null) {
                            // Continuity Check: This departure must be >= previous arrival
                            expect(depTime, `Route "${routeName}" segment ${j} departure (${depStr}) is before previous arrival`).toBeGreaterThanOrEqual(currentArrivalTime);
                        }

                        currentArrivalTime = arrTime;
                    } else {
                        // Implicit timing (Drive/Walk)
                        // If it's the first segment, we don't have a start time yet, so we ignore it
                        // or we could use the "now" time, but let's focus on transitions.
                        if (currentArrivalTime !== null) {
                            console.log(`    Segment ${j}: Implicit (Duration: ${durationStr}) starts at ${currentArrivalTime}`);
                            currentArrivalTime += duration;
                        } else {
                            // First segment with no explicit time
                            // We can't verify continuity yet
                            console.log(`    Segment ${j}: First segment, implicit start.`);
                        }
                    }
                }
            }
        }
    });
});
