import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const startBtn = page.getByText('Begin the March').or(page.getByText('Begin').or(page.getByText('Start')));
if (await startBtn.count() > 0) {
  await startBtn.first().click({ force: true }).catch(() => {});
}
await page.waitForTimeout(3000);

console.log('errs:', errs.length);
errs.slice(0, 5).forEach(e => console.log(' -', e));
await browser.close();
