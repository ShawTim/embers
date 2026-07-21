// Per-art-pass-B visual verification.
//   ch01 (melee):       expect slash arc on swing + unit follow
//   ch04 (rain):        expect rain weather
//   ch11 (snow):        expect snow weather
//   ch12 (lava+ash):    expect ash + embers
//   ch18 (forest+dark): expect dark magic impact
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/art_pass_b";
mkdirSync(OUT, { recursive: true });

const chapters = [
  { id: "ch01", idx: 0, name: "Melee combat", expect: "slash + follow" },
  { id: "ch04", idx: 3, name: "Rain weather", expect: "rain particles" },
  { id: "ch11", idx: 10, name: "Snow weather", expect: "snow particles" },
  { id: "ch12", idx: 11, name: "Lava+ash", expect: "embers + ash" },
  { id: "ch18", idx: 17, name: "Dark + forest", expect: "leaves" },
];

async function settle(page, ms = 800) { await page.waitForTimeout(ms); }

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

  // Verify dev hook exists
  const hookOk = await page.evaluate(() => typeof (window).__initChapter === "function");
  if (!hookOk) {
    console.log("FATAL: window.__initChapter not available");
    process.exit(1);
  }

  for (const ch of chapters) {
    console.log(`\n=== ${ch.id} (${ch.name}) — expect: ${ch.expect} ===`);
    // Dismiss any active dialogue first
    await page.evaluate(() => {
      const d = document.querySelector(".dialogue-overlay");
      if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(page, 300);
    // Jump to chapter
    await page.evaluate((idx) => (window).__initChapter(idx), ch.idx);
    await settle(page, 1200);
    // Dismiss pre-dialogue if any
    for (let i = 0; i < 3; i++) {
      const has = await page.locator(".dialogue-overlay").count();
      if (!has) break;
      await page.evaluate(() => {
        const d = document.querySelector(".dialogue-overlay");
        if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await settle(page, 300);
    }
    await settle(page, 1500); // let particles populate
    await page.screenshot({ path: `${OUT}/${ch.id}_map.png` });
    console.log(`  saved map: ${ch.id}_map.png`);
  }

  // === Combat trigger test: ch01 melee + ch09 magic ===
  console.log(`\n=== Combat test: ch01 melee ===`);
  await page.evaluate(() => (window).__initChapter(0));
  await settle(page, 1200);
  for (let i = 0; i < 3; i++) {
    if (await page.locator(".dialogue-overlay").count()) {
      await page.evaluate(() => {
        const d = document.querySelector(".dialogue-overlay");
        if (d) d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await settle(page, 300);
    } else break;
  }
  // Move Kael to a tile adjacent to an enemy then attack
  const combatState = await page.evaluate(() => {
    const st = (window).__game.getState();
    const kael = st.units.find(u => u.def.id === "kael");
    if (!kael) return { error: "no kael" };
    return { kaelPos: kael.pos, units: st.units.filter(u => u.faction === "enemy").map(u => ({ id: u.def.id, pos: u.pos })) };
  });
  console.log("  Kael:", combatState.kaelPos, " enemies:", JSON.stringify(combatState.units.slice(0, 3)));
  // Click on Kael (tile 1,6) to select him
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const r = c.getBoundingClientRect();
    // Click approx tile (1,6) — depends on camera, but in ch01 the map is small
    const x = r.left + r.width * 0.15;
    const y = r.top + r.height * 0.55;
    c.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, button: 0, bubbles: true }));
    c.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y, button: 0, bubbles: true }));
    c.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, button: 0, bubbles: true }));
  });
  await settle(page, 800);
  await page.screenshot({ path: `${OUT}/combat_select.png` });
  console.log("  saved combat_select.png");

  console.log(`\nTotal errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
