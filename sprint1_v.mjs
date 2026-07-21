// Minimal verify: defend, seize, boss death, next chapter button
// All use direct store calls to avoid AI turn timeouts
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
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE);
  await page.waitForSelector("button:has-text('Start')");
  await page.click("button:has-text('Start')");
  await settle(page, 1500);

  // Test 1: HUD titles for ch03+ (no AI needed)
  console.log("=== HUD titles ===");
  for (const [idx, expect] of [[2, "Defeat Veyne"], [7, "Survive"], [10, "Reach the far side"], [11, "Defeat the dragon"], [13, "Reach the far shore"], [19, "Defeat Zethar"]]) {
    await page.evaluate((i) => (window).__initChapter(i), idx);
    await settle(page, 500);
    await dismissDialogue(page);
    await settle(page, 300);
    const obj = await page.evaluate(() => document.querySelector(".objective")?.textContent);
    const pass = obj && obj.length > 0 && !!(obj.match(expect));
    console.log(`  ch${String(idx+1).padStart(2,"0")}: "${obj}" ${pass ? "PASS" : "FAIL"}`);
  }

  // Test 2: defend at ch04
  console.log("\n=== ch04 defend (full AI turn) ===");
  await page.evaluate(() => (window).__initChapter(3));
  await settle(page, 800); await dismissDialogue(page);
  await page.evaluate(() => (window).__game.setState({ turn: 7 }));
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  let phase4 = "";
  for (let i = 0; i < 80; i++) {
    await settle(page, 1000);
    phase4 = await page.evaluate(() => (window).__game.getState().phase);
    if (phase4 === "victory" || phase4 === "defeat") { console.log(`  after ${i}s`); break; }
  }
  console.log(`  ch04 phase: ${phase4} ${phase4 === "victory" ? "PASS" : "FAIL"}`);

  // Test 3: ch01 boss + next button
  console.log("\n=== ch01 boss + next chapter ===");
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 800); await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const garrick = st.units.find(u => u.def.id === "boss_garrick");
    garrick.isDead = true;
    garrick.hp = 0;
    st.grid.removeUnit(garrick);
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  let phase1 = "";
  for (let i = 0; i < 80; i++) {
    await settle(page, 1000);
    phase1 = await page.evaluate(() => (window).__game.getState().phase);
    if (phase1 === "victory") { console.log(`  after ${i}s`); break; }
    // Dismiss dialogue
    const dlg = await page.evaluate(() => (window).__game.getState().activeDialogue);
    if (dlg) await page.evaluate(() => { const d = document.querySelector(".dialogue-overlay"); if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  }
  console.log(`  ch01 phase: ${phase1} ${phase1 === "victory" ? "PASS" : "FAIL"}`);

  // Click "Next Chapter" button
  if (phase1 === "victory") {
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => /Next|下一章/.test(b.textContent || ""));
      if (btn) { btn.click(); return true; } return false;
    });
    console.log(`  Next button found: ${clicked}`);
    await settle(page, 1500);
    await dismissDialogue(page);
    const newCh = await page.evaluate(() => (window).__game.getState().chapter?.id);
    console.log(`  After Next: chapter = ${newCh} ${newCh === "ch02" ? "PASS" : "FAIL"}`);
  }

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
