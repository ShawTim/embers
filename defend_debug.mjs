// Direct defend test
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
async function settle(p, ms) { await p.waitForTimeout(ms); }
async function dismissDialogue(p) {
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
  await page.goto(BASE);
  await page.waitForSelector("button:has-text('Start')");
  await page.click("button:has-text('Start')");
  await settle(page, 1500);
  // ch04 fresh
  await page.evaluate(() => (window).__initChapter(3));
  await settle(page, 1000);
  await dismissDialogue(page);
  // Set turn to 7 directly (skip waiting for AI)
  await page.evaluate(() => (window).__game.setState({ turn: 7 }));
  // Trigger checkBattleEnd by ending turn
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  // Poll for phase=player (enemy turn running)
  let phase = "";
  for (let i = 0; i < 60; i++) {
    await settle(page, 1000);
    phase = await page.evaluate(() => (window).__game.getState().phase);
    const turn = await page.evaluate(() => (window).__game.getState().turn);
    console.log(`  [${i}s] phase=${phase} turn=${turn}`);
    if (phase === "victory" || phase === "defeat") break;
  }
  console.log(`final phase: ${phase}`);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
