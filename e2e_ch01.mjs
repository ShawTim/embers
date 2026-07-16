import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e3", { recursive: true });

const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const errors = [];
const consoleErr = [];
const findings = [];

function log(...a) { console.log(...a); }
function note(s) { findings.push(s); console.log("  📝", s); }
function fail(s) { findings.push("❌ " + s); console.log("  ❌", s); }

async function skipDialogue(page) {
  // Keep clicking until overlay disappears. Wait long enough between clicks
  // for typewriter (25ms/char × ~100 chars = 2.5s per line worst case).
  for (let i = 0; i < 30; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return true;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(350);
  }
  return await page.locator(".dialogue-overlay").count() === 0;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { errors.push("pageerror: " + e.message); console.log("  [pageerror]", e.message); });
  page.on("console", (m) => { if (m.type() === "error") { consoleErr.push("console: " + m.text()); console.log("  [console.error]", m.text()); } });

  console.log("\n=== STEP 1: Landing page ===");
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/e2e3/01_landing.png" });
  await page.locator('button:has-text("START")').first().click();
  log("✓ Clicked START GAME");

  console.log("\n=== STEP 2: Skip pre-dialogue ===");
  await page.waitForTimeout(2000);
  const skipped = await skipDialogue(page);
  log("Dialogue skipped:", skipped);
  if (!skipped) fail("Dialogue didn't close after 30 clicks");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/e2e3/02_ch01_ready.png" });

  // Confirm dialogue is really closed
  const dialogCount = await page.locator(".dialogue-overlay").count();
  log("Dialogue overlays remaining:", dialogCount);

  console.log("\n=== STEP 3: HUD state ===");
  log("Turn:", await page.locator(".turn-badge").textContent().catch(() => null));
  log("Phase:", await page.locator(".phase-badge").textContent().catch(() => null));
  log("Counts:", await page.locator(".unit-counts").textContent().catch(() => null));

  // ---- Step 4: Find player units by hover ----
  console.log("\n=== STEP 4: Hover sweep for player units ===");
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  log("Canvas:", cbox.width, "x", cbox.height);

  const hits = [];
  for (let yp = 0.40; yp <= 0.85; yp += 0.04) {
    for (let xp = 0.05; xp <= 0.55; xp += 0.04) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(50);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 10) {
        const k = `${xp.toFixed(2)},${yp.toFixed(2)}`;
        if (!hits.find(h => h.k === k)) {
          hits.push({ k, xp, yp, panel: panel.substring(0, 60).replace(/\n/g, " ") });
        }
      }
    }
  }
  log("Player units found:", hits.length);
  for (const h of hits) log("  ", h.k, "—", h.panel);
  if (hits.length === 0) fail("No player units found on map (hover sweep)");
  await page.screenshot({ path: "/tmp/e2e3/03_hover_sweep.png" });

  // ---- Step 5: Click first player unit ----
  console.log("\n=== STEP 5: Click first unit ===");
  const first = hits[0];
  if (first) {
    await page.mouse.click(cbox.x + cbox.width * first.xp, cbox.y + cbox.height * first.yp);
    await page.waitForTimeout(800);
    await page.screenshot({ path: "/tmp/e2e3/04_unit_selected.png" });
    const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
    log("Panel after click:", panel?.substring(0, 100).replace(/\n/g, " | "));
    if (panel?.includes("Click or hover")) fail("Click didn't select unit");
    else log("✓ Unit selected");
  }

  // ---- Step 6: Move 3 tiles right ----
  console.log("\n=== STEP 6: Move ===");
  if (first) {
    for (let dx = 0.03; dx <= 0.20; dx += 0.03) {
      await page.mouse.click(cbox.x + cbox.width * (first.xp + dx), cbox.y + cbox.height * first.yp);
      await page.waitForTimeout(400);
      const menu = await page.locator(".action-menu").count();
      if (menu > 0) {
        log("✓ Action menu appeared at dx = " + dx.toFixed(2));
        await page.screenshot({ path: "/tmp/e2e3/05_action_menu.png" });
        break;
      }
    }
  }

  // ---- Step 7: Attack ----
  console.log("\n=== STEP 7: Attack ===");
  const attackBtn = page.locator('.action-menu button:has-text("Attack"), .action-menu button:has-text("攻擊")').first();
  if (await attackBtn.count() > 0) {
    await attackBtn.click();
    log("✓ Clicked Attack");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "/tmp/e2e3/06_targeting.png" });

    // Click on enemy (right side, around x=0.7-0.85)
    await page.mouse.click(cbox.x + cbox.width * 0.78, cbox.y + cbox.height * 0.5);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "/tmp/e2e3/07_after_attack.png" });

    const phase = await page.locator(".phase-badge").textContent().catch(() => null);
    const log = await page.locator(".combat-log").textContent().catch(() => null);
    log("Phase after attack:", phase);
    log("Combat log:", log?.substring(0, 200));
  } else {
    note("No Attack button — try Wait instead");
    const waitBtn = page.locator('.action-menu button:has-text("Wait"), .action-menu button:has-text("等待")').first();
    if (await waitBtn.count() > 0) {
      await waitBtn.click();
      log("Clicked Wait");
      await page.waitForTimeout(500);
    }
  }

  // ---- Step 8: End turn ----
  console.log("\n=== STEP 8: End turn ===");
  const endTurn = page.locator('.btn-end-turn');
  if (await endTurn.count() > 0 && await endTurn.isVisible()) {
    await endTurn.click({ force: true });
    log("✓ End Turn clicked");
    await page.waitForTimeout(8000);
    await page.screenshot({ path: "/tmp/e2e3/08_after_enemy_turn.png" });
    const phase = await page.locator(".phase-badge").textContent().catch(() => null);
    const turn = await page.locator(".turn-badge").textContent().catch(() => null);
    log("After end turn — Turn:", turn, "| Phase:", phase);
  }

  log("\n=== ERRORS ===");
  log("pageerror count:", errors.length);
  log("console.error count:", consoleErr.length);
  for (const e of errors.slice(0, 10)) log("  pageerror:", e);
  for (const e of consoleErr.slice(0, 10)) log("  console.error:", e);

  writeFileSync("/tmp/e2e3/errors.json", JSON.stringify({ pageErrors: errors, consoleErrors: consoleErr, findings }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
