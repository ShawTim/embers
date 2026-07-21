// Combat test: ch01 melee to see slash trail
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/art_pass_b";
mkdirSync(OUT, { recursive: true });

async function settle(page, ms = 600) { await page.waitForTimeout(ms); }

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
  // ch01
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 800);
  await dismissDialogue(page);
  await settle(page, 800);

  // Move Kael next to a bandit_axe (8,3) by teleporting via store
  // Place Kael at (7,3) so he can attack (8,3)
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    kael.pos = { x: 7, y: 3 };
    st.grid.placeUnit(kael, { x: 7, y: 3 });
    (window).__game.setState({ units: [...st.grid.getAllUnits()] });
  });
  await settle(page, 400);
  await page.screenshot({ path: `${OUT}/c1_kael_moved.png` });

  // Click Kael via the store API directly (more reliable than canvas coords)
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.selectUnit(kael);
  });
  await settle(page, 400);
  await page.screenshot({ path: `${OUT}/c1_selected.png` });

  // Set pendingMove so attackTarget has a valid pre-move position
  await page.evaluate(() => {
    const st = (window).__game.getState();
    (window).__game.setState({ pendingMove: { x: 7, y: 3 } });
  });
  await settle(page, 100);

  // Confirm Attack via the action menu
  const attackBtn = page.locator("button:has-text('Attack')");
  if (await attackBtn.count() > 0) {
    await attackBtn.first().click();
    await settle(page, 400);
    await page.screenshot({ path: `${OUT}/c1_targeting.png` });
  }

  // Click target via store
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const enemy = st.units.find(u => u.def.id === "bandit_axe" && !u.isDead);
    if (enemy) st.attackTarget(enemy);
  });
  // Snap during combat (windup/strike phases)
  await settle(page, 600);
  await page.screenshot({ path: `${OUT}/c1_strike.png` });
  await settle(page, 250);
  await page.screenshot({ path: `${OUT}/c1_impact.png` });
  await settle(page, 500);
  await page.screenshot({ path: `${OUT}/c1_after.png` });

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
