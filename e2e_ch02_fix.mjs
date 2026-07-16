import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e9", { recursive: true });
const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];
const consoleErrors = [];

async function skipDialogue(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return true;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(250);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { pageErrors.push(e.message); console.log("[pageerror]", e.message); });
  page.on("console", (m) => { if (m.type() === "error") { consoleErrors.push(m.text()); console.log("[console.error]", m.text()); } });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);

  // Play ch01 first
  console.log("=== CH01 ===");
  await skipDialogue(page);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 25; i++) {
    const end = page.locator(".btn-end-turn");
    if (await end.count() > 0 && await end.isVisible()) {
      await end.click({ force: true });
      await page.waitForTimeout(20000);
    }
    if (await page.locator(".dialogue-overlay").count() > 0) {
      console.log("  dialogue at iter", i);
      await skipDialogue(page);
      await page.waitForTimeout(1000);
    }
    const counts = await page.locator(".unit-counts").textContent().catch(() => "");
    const turn = await page.locator(".turn-badge").textContent().catch(() => "");
    if (i % 3 === 0) console.log(`  iter ${i}: ${turn} ${counts}`);
    if (counts && (counts.includes("0 ready") || counts.includes("· 0 enemies"))) break;
  }
  await page.screenshot({ path: "/tmp/e2e9/after_ch01.png" });
  const turn1 = await page.locator(".turn-badge").textContent();
  const counts1 = await page.locator(".unit-counts").textContent();
  console.log("After ch01:", turn1, counts1);

  // Force jump to ch02 via dispatching a custom event through React DevTools approach
  // Actually, the easier way: directly click the "Next Chapter" button if visible
  console.log("\n=== FORCE ch02 via Next Chapter button ===");
  // Find victory big message
  await page.screenshot({ path: "/tmp/e2e9/before_force.png" });
  // Skip any current dialogue
  for (let i = 0; i < 30; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) break;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2000);
  // Look for "Next Chapter" button (only shows on victory)
  const nextChap = page.locator("button:has-text('Next Chapter'), button:has-text('下一章')");
  if (await nextChap.count() > 0) {
    console.log("Found Next Chapter button, clicking");
    await nextChap.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("No Next Chapter button — using JS force to call initChapter(1)");
    // Try to find zustand store via React fiber
    const ok = await page.evaluate(() => {
      // Look for HUD's React fiber
      const hud = document.querySelector(".hud-top");
      if (!hud) return "no hud";
      // Walk React fiber to find store
      const key = Object.keys(hud).find(k => k.startsWith("__reactFiber"));
      if (!key) return "no fiber";
      let node = hud[key];
      // Walk up to find a component with useGame state
      while (node) {
        if (node.memoizedState && node.memoizedState.next) {
          // Try to find a function that calls initChapter
          let hook = node.memoizedState;
          let tries = 0;
          while (hook && tries < 50) {
            if (hook.queue && hook.queue.lastRenderedState && typeof hook.queue.lastRenderedState === 'object' && hook.queue.lastRenderedState.initChapter) {
              hook.queue.lastRenderedState.initChapter(1);
              return "ok";
            }
            hook = hook.next;
            tries++;
          }
        }
        node = node.return;
      }
      return "not found";
    });
    console.log("Force result:", ok);
    await page.waitForTimeout(2000);
  }
  // Skip any dialogue that pops up
  for (let i = 0; i < 30; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) break;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/e2e9/forced_ch02.png" });
  const turn2 = await page.locator(".turn-badge").textContent();
  const counts2 = await page.locator(".unit-counts").textContent();
  console.log("After force ch02:", turn2, counts2);

  // Play ch02 a bit
  for (let i = 0; i < 4; i++) {
    const end = page.locator(".btn-end-turn");
    if (await end.count() > 0 && await end.isVisible()) {
      await end.click({ force: true });
      await page.waitForTimeout(20000);
    }
  }
  await page.screenshot({ path: "/tmp/e2e9/ch02_mid.png" });

  // Hover sweep ch02 to find Cult Captain
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  const found = new Map();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  for (let yp = 0.30; yp <= 0.95; yp += 0.05) {
    for (let xp = 0.05; xp <= 0.95; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(20);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 40).replace(/\n/g, " ");
        if (!found.has(name)) {
          found.set(name, { xp, yp });
          console.log(`  found: ${name} at (${xp.toFixed(2)},${yp.toFixed(2)})`);
        }
      }
    }
  }
  await page.screenshot({ path: "/tmp/e2e9/ch02_units.png" });
  const hasCultCaptain = [...found.keys()].some(k => k.toLowerCase().includes("cult captain"));
  const hasGarrick = [...found.keys()].some(k => k.toLowerCase().includes("garrick"));
  console.log("Cult Captain present:", hasCultCaptain);
  console.log("Garrick present:", hasGarrick);

  console.log("\n=== ERRORS ===");
  console.log("pageerror:", pageErrors.length, "console.error:", consoleErrors.length);
  writeFileSync("/tmp/e2e9/units.json", JSON.stringify([...found.keys()], null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
