// Sprint 5 visual check
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/sprint5";
mkdirSync(OUT, { recursive: true });
async function settle(p, ms) { await p.waitForTimeout(ms); }
async function dismiss(p) {
  for (let i = 0; i < 8; i++) {
    if (await p.locator(".dialogue-overlay").count() === 0) return;
    await p.evaluate(() => { const d = document.querySelector(".dialogue-overlay"); if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await settle(p, 200);
  }
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE);
  await page.waitForSelector("button:has-text('Start')");
  await page.click("button:has-text('Start')");
  await settle(page, 1500);

  // BOSS ground crack: jump to ch01, screenshot of garrick
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1500); // let intro pan + boss placement settle
  await dismiss(page);
  await settle(page, 500);
  await page.screenshot({ path: `${OUT}/ch01_boss_crack.png` });
  console.log("saved ch01_boss_crack.png");

  // Chapter intro pan: jump to ch14 and screenshot at t=0 and t=800ms
  await page.evaluate(() => (window).__initChapter(13));
  await settle(page, 200); // mid-pan
  await page.screenshot({ path: `${OUT}/ch14_intro_pan1.png` });
  await settle(page, 1200);
  await page.screenshot({ path: `${OUT}/ch14_intro_pan2.png` });
  console.log("saved ch14 intro pan shots");

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
