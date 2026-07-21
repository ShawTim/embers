// Direct checkBattleEnd test — bypass the AI turn to verify the victory logic
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

  // Test 1: ch04 defend at turn 7
  console.log("=== ch04 defend ===");
  await page.evaluate(() => (window).__initChapter(3));
  await settle(page, 800); await dismissDialogue(page);
  await page.evaluate(() => (window).__game.setState({ turn: 7 }));
  // Call endPlayerTurn + simulate the parts of processEnemyTurn that matter
  await page.evaluate(() => {
    // Skip AI entirely: just set phase to player + increment turn + check
    const st = (window).__game.getState();
    (window).__game.setState({ turn: st.turn + 1 });
  });
  // Now we need to actually call checkBattleEnd. The function is module-internal.
  // Workaround: trigger via endPlayerTurn (which kicks off processEnemyTurn) but
  // we can short-circuit by directly setting phase to enemy then back to player.
  // Actually the simplest: call endPlayerTurn then call waitUnit on a player unit
  // which calls checkBattleEnd.
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  // Wait for enemy turn to start
  await settle(page, 1000);
  // Force the end: set phase back to player, run checkBattleEnd by ending turn again
  // Actually the cleanest: just call endPlayerTurn and wait for the AI to finish
  // With only 2 enemies and short AI logic, ch04 takes ~30s. Let me just wait.
  let phase4 = "";
  for (let i = 0; i < 60; i++) {
    await settle(page, 1000);
    phase4 = await page.evaluate(() => (window).__game.getState().phase);
    if (phase4 === "victory" || phase4 === "defeat") { console.log(`  after ${i}s`); break; }
  }
  console.log(`  phase: ${phase4} ${phase4 === "victory" ? "PASS" : "FAIL"}`);

  // Test 2: ch14 seize — simpler: set phase=enemy+player bypass
  console.log("\n=== ch14 seize (direct) ===");
  await page.evaluate(() => (window).__initChapter(13));
  await settle(page, 800); await dismissDialogue(page);
  // Move Kael to seizeTile
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.grid.placeUnit(kael, { x: 16, y: 5 });
    kael.pos = { x: 16, y: 5 };
    (window).__game.setState({ units: [...st.grid.getAllUnits()] });
  });
  // Call waitUnit: this triggers checkBattleEnd at the end
  // First need pendingMove
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.selectUnit(kael);
    st.confirmMove({ x: 16, y: 5 });
    // Now call wait (simpler than full attack flow)
    // waitUnit uses pendingMove to move the unit
    const u = st.selectedUnit;
    st.grid.moveUnit(u, { x: 16, y: 5 });
    u.hasActed = true;
    (window).__game.setState({ selectedUnit: null, pendingMove: null, units: [...st.grid.getAllUnits()] });
  });
  await settle(page, 500);
  // Now check phase
  const phase14 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  phase after waitUnit: ${phase14} ${phase14 === "victory" ? "PASS" : "FAIL"}`);

  // Test 3: ch12 boss death via direct mutation
  console.log("\n=== ch12 boss death (direct) ===");
  await page.evaluate(() => (window).__initChapter(11));
  await settle(page, 800); await dismissDialogue(page);
  // Kill dragon + call waitUnit
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const dragon = st.units.find(u => u.def.id === "umbral_dragon");
    dragon.isDead = true;
    dragon.hp = 0;
    st.grid.removeUnit(dragon);
    // Now set up: a player unit ready to take an action that triggers checkBattleEnd
    const kael = st.units.find(u => u.def.id === "kael");
    st.selectUnit(kael);
    st.confirmMove({ x: kael.pos.x, y: kael.pos.y });
    const u = st.selectedUnit;
    u.hasActed = true;
    (window).__game.setState({ selectedUnit: null, pendingMove: null, units: [...st.grid.getAllUnits()] });
  });
  await settle(page, 500);
  const phase12 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  phase: ${phase12} ${phase12 === "victory" ? "PASS" : "FAIL"}`);

  // Test 4: ch01 boss death
  console.log("\n=== ch01 boss death (direct) ===");
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 800); await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const garrick = st.units.find(u => u.def.id === "boss_garrick");
    garrick.isDead = true;
    garrick.hp = 0;
    st.grid.removeUnit(garrick);
    const kael = st.units.find(u => u.def.id === "kael");
    st.selectUnit(kael);
    st.confirmMove({ x: kael.pos.x, y: kael.pos.y });
    const u = st.selectedUnit;
    u.hasActed = true;
    (window).__game.setState({ selectedUnit: null, pendingMove: null, units: [...st.grid.getAllUnits()] });
  });
  await settle(page, 500);
  const phase1 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  phase: ${phase1} ${phase1 === "victory" ? "PASS" : "FAIL"}`);

  // Test 5: Next chapter button
  if (phase1 === "victory") {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Next") || b.textContent?.includes("下一章"));
      if (btn) btn.click();
    });
    await settle(page, 1000);
    const newCh = await page.evaluate(() => (window).__game.getState().chapter?.id);
    console.log(`  After Next: chapter = ${newCh} ${newCh === "ch02" ? "PASS" : "FAIL"}`);
  }

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
