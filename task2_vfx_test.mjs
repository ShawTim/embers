// Visual check for combat feedback: crit flash, HP ghost, magic death
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/task2_visual";
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

  // === Test 1: crit flash + HP ghost on a melee attack ===
  // Force a crit: stub Math.random to always pass the crit check
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 500);
  // Move Kael next to bandit then attack
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.grid.placeUnit(kael, { x: 7, y: 3 });
    kael.pos = { x: 7, y: 3 };
    st.selectUnit(kael);
    st.confirmMove({ x: 7, y: 3 });
    (window).__game.setState({ units: [...st.grid.getAllUnits()] });
  });
  await settle(page, 300);
  // Force crit by overriding resolveCombat
  await page.evaluate(() => {
    const origRandom = Math.random;
    let i = 0;
    (window).__origRandom = origRandom;
    // Sequence: hit-check (0 = always hit), crit-check (0 = always crit)
    Math.random = () => { const r = i % 2; i++; return r; };
  });
  // Trigger attack via store
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const enemy = st.units.find(u => u.def.id === "bandit_sword" && !u.isDead);
    if (enemy) st.attackTarget(enemy);
  });
  // Snap at strike (crit flash + HP ghost should be visible)
  await settle(page, 700);
  await page.screenshot({ path: `${OUT}/crit_flash.png` });
  console.log("saved crit_flash.png");
  // Snap at impact
  await settle(page, 300);
  await page.screenshot({ path: `${OUT}/crit_impact.png` });
  console.log("saved crit_impact.png");
  // Wait for combat to finish
  await settle(page, 2500);
  await page.screenshot({ path: `${OUT}/crit_after.png` });

  // === Test 2: Magic death (kill a horror with light weapon) ===
  await page.evaluate(() => {
    if ((window).__origRandom) Math.random = (window).__origRandom;
  });
  await page.evaluate(() => (window).__initChapter(15));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 500);
  // Kill a void_wraith (uses Witch model) with Maren (fire magic)
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const maren = st.units.find(u => u.def.id === "maren");
    const wraith = st.units.find(u => u.def.id === "void_wraith" && !u.isDead);
    if (maren && wraith) {
      wraith.hp = 1; // ensure 1-shot kill
      st.grid.placeUnit(maren, { x: wraith.pos.x - 1, y: wraith.pos.y });
      maren.pos = { x: wraith.pos.x - 1, y: wraith.pos.y };
      st.selectUnit(maren);
      st.confirmMove(maren.pos);
      (window).__game.setState({ units: [...st.grid.getAllUnits()] });
      st.attackTarget(wraith);
    }
  });
  // Snap during magic death animation
  await settle(page, 600);
  await page.screenshot({ path: `${OUT}/magic_death_1.png` });
  await settle(page, 400);
  await page.screenshot({ path: `${OUT}/magic_death_2.png` });
  console.log("saved magic_death screenshots");

  // === Test 3: idle breathing — should be visible now ===
  // Just sit on ch01 for a bit
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1500);
  await dismiss(page);
  await settle(page, 500);
  // Select Kael
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.selectUnit(kael);
  });
  // Take 3 frames over 0.5s to capture breathing
  for (let i = 0; i < 3; i++) {
    await settle(page, 150);
    await page.screenshot({ path: `${OUT}/breathing_${i}.png` });
  }
  console.log("saved breathing screenshots");

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
