// Focused defend + seize test
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
  await page.goto(BASE);
  await page.waitForSelector("button:has-text('Start')");
  await page.click("button:has-text('Start')");
  await settle(page, 1500);

  // === Test defend: ch04 (objectiveTurns=6 after my rebalance) ===
  console.log("=== ch04 defend ===");
  await page.evaluate(() => (window).__initChapter(3));
  await settle(page, 1000);
  await dismissDialogue(page);
  // Force turn to 7 so defend fires after enemy turn
  await page.evaluate(() => (window).__game.setState({ turn: 7 }));
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  // Poll for victory
  let phase4 = "";
  for (let i = 0; i < 60; i++) {
    await settle(page, 1000);
    phase4 = await page.evaluate(() => (window).__game.getState().phase);
    if (phase4 === "victory" || phase4 === "defeat") break;
  }
  console.log(`  ch04 phase: ${phase4} ${phase4 === "victory" ? "PASS" : "FAIL"}`);

  // === Test seize: ch14 ===
  console.log("\n=== ch14 seize ===");
  await page.evaluate(() => (window).__initChapter(13));
  await settle(page, 1000);
  await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    st.grid.placeUnit(kael, { x: 16, y: 5 });
    kael.pos = { x: 16, y: 5 };
    (window).__game.setState({ units: [...st.grid.getAllUnits()] });
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  let phase14 = "";
  for (let i = 0; i < 90; i++) {
    await settle(page, 1000);
    phase14 = await page.evaluate(() => (window).__game.getState().phase);
    const dialogue = await page.evaluate(() => (window).__game.getState().activeDialogue);
    if (phase14 === "victory") break;
    if (dialogue) {
      await page.evaluate(() => { const d = document.querySelector(".dialogue-overlay"); if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    }
  }
  console.log(`  ch14 phase: ${phase14} ${phase14 === "victory" ? "PASS" : "FAIL"}`);

  // === Test ch12 dragon boss death ===
  console.log("\n=== ch12 boss death ===");
  await page.evaluate(() => (window).__initChapter(11));
  await settle(page, 1000);
  await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const dragon = st.units.find(u => u.def.id === "umbral_dragon");
    dragon.isDead = true;
    dragon.hp = 0;
    st.grid.removeUnit(dragon);
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  let phase12 = "";
  for (let i = 0; i < 90; i++) {
    await settle(page, 1000);
    phase12 = await page.evaluate(() => (window).__game.getState().phase);
    const dialogue = await page.evaluate(() => (window).__game.getState().activeDialogue);
    if (phase12 === "victory") break;
    if (dialogue) {
      await page.evaluate(() => { const d = document.querySelector(".dialogue-overlay"); if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    }
  }
  console.log(`  ch12 phase: ${phase12} ${phase12 === "victory" ? "PASS" : "FAIL"}`);

  // === Test victory button: ch01 → ch02 ===
  console.log("\n=== victory button advancement ===");
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1000);
  await dismissDialogue(page);
  await page.evaluate(() => {
    const st = (window).__game.getState();
    const garrick = st.units.find(u => u.def.id === "boss_garrick");
    garrick.isDead = true;
    garrick.hp = 0;
    st.grid.removeUnit(garrick);
  });
  await page.evaluate(() => (window).__game.getState().endPlayerTurn());
  let phase1 = "";
  for (let i = 0; i < 90; i++) {
    await settle(page, 1000);
    phase1 = await page.evaluate(() => (window).__game.getState().phase);
    const dialogue = await page.evaluate(() => (window).__game.getState().activeDialogue);
    if (phase1 === "victory") break;
    if (dialogue) {
      await page.evaluate(() => { const d = document.querySelector(".dialogue-overlay"); if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    }
  }
  console.log(`  ch01 phase: ${phase1} ${phase1 === "victory" ? "PASS" : "FAIL"}`);

  // Test the button itself
  if (phase1 === "victory") {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Next") || b.textContent?.includes("下一章"));
      if (btn) btn.click();
    });
    await settle(page, 1500);
    const newCh = await page.evaluate(() => (window).__game.getState().chapter?.id);
    console.log(`  After Next: chapter = ${newCh} ${newCh === "ch02" ? "PASS" : "FAIL"}`);
  }

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
