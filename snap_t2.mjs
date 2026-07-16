import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const startBtn = page.getByText('Begin the March').or(page.getByText('Begin').or(page.getByText('Start')));
if (await startBtn.count() > 0) {
  await startBtn.first().click({ force: true }).catch(() => {});
}
await page.waitForTimeout(2000);

// Click the dialogue overlay to advance many times to clear all
for (let i = 0; i < 20; i++) {
  const overlay = await page.$('.dialogue-overlay');
  if (overlay) {
    await overlay.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);

// Take baseline screenshot
await page.screenshot({ path: '/tmp/t2_baseline.png' });

// Click a unit to select it (move range should appear)
const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
// Click a unit position (left side, around y=200)
await page.mouse.click(box.x + 130, box.y + 380);
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/t2_selected.png' });

// Wait for animation to see wind sway (delay 1.5s for movement)
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/t2_wind.png' });

console.log('errs:', errs.length);
errs.slice(0, 5).forEach(e => console.log(' -', e));
await browser.close();
