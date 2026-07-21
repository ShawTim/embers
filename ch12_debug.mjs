// Sprint 1 focused test
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function settle(p, ms = 500) { await p.waitForTimeout(ms); }
async function dismissDialogue(p) {
  for (let i = 0; i < 8; i++) {
    if (await p.locator(".dialogue-overlay").count() === 0) return;
    await p.evaluate(() => {
      const d = document.querySelector(".dialogue-overlay");
      if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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

  // ch12 fresh
  await page.evaluate(() => (window).__initChapter(11));
  await settle(page, 1000);
  await dismissDialogue(page);
  await settle(page, 500);
  const units = await page.evaluate(() => (window).__game.getState().units.map(u => ({ id: u.def.id, isBoss: u.isBoss, isDead: u.isDead, pos: u.pos })));
  console.log("ch12 units:");
  for (const u of units) console.log("  ", u);

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
