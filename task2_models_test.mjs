// Visual check for new model assignments
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/task2_models";
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
  await page.waitForSelector("button:has-text('Start')", { timeout: 60000 });
  await page.click("button:has-text('Start')");
  await settle(page, 2500);

  // ch01: Kael + Lyra + Borin + Serra vs bandits (Barbarian/OrcBrute)
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/ch01.png` });
  console.log("saved ch01.png");

  // ch03: introduces Maren vs cultists (Tiefling)
  await page.evaluate(() => (window).__initChapter(2));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/ch03_cultists.png` });
  console.log("saved ch03_cultists.png");

  // ch06: has Cult Captain (BlackKnight) + heavy (OrcBrute)
  await page.evaluate(() => (window).__initChapter(5));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/ch06_captain.png` });
  console.log("saved ch06_captain.png");

  // ch13: introduces Yuki (Protagonist_B) vs cult_archer (Ranger)
  await page.evaluate(() => (window).__initChapter(12));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/ch13_yuki.png` });
  console.log("saved ch13_yuki.png");

  // ch18: Darius (Protagonist_A) + Yuki vs Horror/Wraith
  await page.evaluate(() => (window).__initChapter(17));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/ch18_darius.png` });
  console.log("saved ch18_darius.png");

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
