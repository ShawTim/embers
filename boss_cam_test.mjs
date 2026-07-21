// Boss cinematic test: ch01 first enemy turn should trigger BOSS intro + camera pull-back
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/art_pass_b";
mkdirSync(OUT, { recursive: true });

async function settle(page, ms = 400) { await page.waitForTimeout(ms); }
async function dismissDialogue(page) {
  for (let i = 0; i < 5; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return;
    await page.evaluate(() => {
      const d = document.querySelector(".dialogue-overlay");
      if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(page, 300);
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
  await dismissDialogue(page);
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 800);
  await dismissDialogue(page);
  await settle(page, 600);

  // Take a "before end turn" snapshot for camera comparison
  await page.screenshot({ path: `${OUT}/boss_before.png` });

  // End the player turn to trigger enemy turn → boss entrance
  await page.evaluate(() => {
    (window).__game.getState().endPlayerTurn();
  });

  // Snap right after end-turn (within the 500ms setTimeout + 900ms slow-mo window)
  for (let i = 0; i < 10; i++) {
    await settle(page, 150);
    const bossActive = await page.evaluate(() => !!((window).__game.getState().bossEntrance));
    if (bossActive) {
      await page.screenshot({ path: `${OUT}/boss_pullback_${i}.png` });
      console.log(`  saved boss_pullback_${i}.png (bossActive=true)`);
      break;
    }
  }
  // One more snap to see the name banner
  await settle(page, 200);
  await page.screenshot({ path: `${OUT}/boss_banner.png` });

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
