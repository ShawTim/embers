// Sprint 1 verification: defend wins + seize wins + ch12 dragon + HUD titles
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/sprint1";
mkdirSync(OUT, { recursive: true });

async function settle(p, ms = 500) { await p.waitForTimeout(ms); }
async function dismissDialogue(p) {
  for (let i = 0; i < 5; i++) {
    if (await p.locator(".dialogue-overlay").count() === 0) return;
    await p.evaluate(() => {
      const d = document.querySelector(".dialogue-overlay");
      if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(p, 300);
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

  // Test HUD title for ch03+ (should NOT be empty)
  for (const [idx, name] of [[2, "ch03"], [7, "ch08"], [10, "ch11"], [15, "ch16"]]) {
    await page.evaluate((i) => (window).__initChapter(i), idx);
    await settle(page, 800);
    await dismissDialogue(page);
    await settle(page, 400);
    const obj = await page.evaluate(() => document.querySelector(".objective")?.textContent);
    console.log(`  ${name} objective: "${obj}"`);
  }

  // Test defend: ch04 should auto-win when turn >= objectiveTurns (now 6)
  console.log("\n=== Test: ch04 defend ===");
  await page.evaluate(() => (window).__initChapter(3));
  await settle(page, 800);
  await dismissDialogue(page);
  // Directly set turn to 6 + simulate end-of-turn check
  await page.evaluate(() => {
    const st = (window).__game.getState();
    st.turn = 6;
    (window).__game.setState({ turn: 6 });
    st.endPlayerTurn();
  });
  await settle(page, 20000); // wait for enemy turn to complete
  const phase4 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  ch04 phase after defend: ${phase4} (expect victory)`);

  // Test seize: ch14 (frozen lake), put Kael on the seizeTile
  console.log("\n=== Test: ch14 seize ===");
  await page.evaluate(() => (window).__initChapter(13));
  await settle(page, 800);
  await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.grid.placeUnit(kael, { x: 16, y: 5 });
    kael.pos = { x: 16, y: 5 };
    (window).__game.setState({ units: [...st.grid.getAllUnits()] });
  });
  // Now end turn — checkBattleEnd will be called after enemy turn
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  await settle(page, 20000);
  const phase14 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  ch14 phase after seize: ${phase14} (expect victory)`);

  // Test ch12 dragon boss
  console.log("\n=== Test: ch12 dragon ===");
  await page.evaluate(() => (window).__initChapter(11));
  await settle(page, 800);
  await dismissDialogue(page);
  await settle(page, 500);
  const hasDragon = await page.evaluate(() => !!((window).__game.getState().units.find(u => u.def.id === "umbral_dragon" && u.isBoss)));
  console.log(`  ch12 has boss dragon: ${hasDragon}`);
  // Kill the dragon + end turn so checkBattleEnd fires
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const dragon = st.units.find(u => u.def.id === "umbral_dragon");
    if (dragon) { dragon.isDead = true; dragon.hp = 0; st.grid.removeUnit(dragon); (window).__game.setState({ units: [...st.grid.getAllUnits()] }); }
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  await settle(page, 20000);
  const phase12 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  ch12 phase after dragon dies: ${phase12} (expect victory)`);
  await page.screenshot({ path: `${OUT}/ch12_victory.png` });

  // Test victory button advancement: ch01 victory → ch02
  console.log("\n=== Test: victory button ===");
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 800);
  await dismissDialogue(page);
  // Kill garrick + end turn
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const garrick = st.units.find(u => u.def.id === "boss_garrick");
    if (garrick) { garrick.isDead = true; garrick.hp = 0; st.grid.removeUnit(garrick); (window).__game.setState({ units: [...st.grid.getAllUnits()] }); }
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  await settle(page, 20000);
  await page.screenshot({ path: `${OUT}/ch01_victory.png` });
  const phase1 = await page.evaluate(() => (window).__game.getState().phase);
  console.log(`  ch01 phase: ${phase1} (expect victory)`);

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
