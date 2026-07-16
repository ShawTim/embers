import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e5", { recursive: true });

const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];
const consoleErrors = [];
const findings = [];

function note(s) { findings.push(s); console.log("  📝", s); }
function fail(s) { findings.push("❌ " + s); console.log("  ❌", s); }

async function skipDialogue(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return true;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(250);
  }
  return false;
}

async function getState(page) {
  const turn = await page.locator(".turn-badge").textContent().catch(() => "?");
  const phase = await page.locator(".phase-badge").textContent().catch(() => "?");
  const counts = await page.locator(".unit-counts").textContent().catch(() => "?");
  return { turn: turn?.trim(), phase: phase?.trim(), counts: counts?.trim() };
}

async function findAllUnitsByHover(page) {
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  const found = new Map();
  // Sweep full canvas
  for (let yp = 0.30; yp <= 0.95; yp += 0.05) {
    for (let xp = 0.05; xp <= 0.95; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(20);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 30).replace(/\n/g, " ");
        if (!found.has(name)) found.set(name, { xp, yp });
      }
    }
  }
  return found;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    const rec = `[${new Date().toISOString()}] pageerror: ${e.message}\n${e.stack || ""}`;
    pageErrors.push(rec);
    console.log("[pageerror]", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const rec = `[${new Date().toISOString()}] console: ${m.text()}`;
      consoleErrors.push(rec);
      console.log("[console.error]", m.text());
    }
  });

  // Start
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  // Click Start Game using DOM click (bypass r3f canvas raycast blockers)
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) { (btn).click(); return true; }
    return false;
  });
  console.log("✓ Clicked Start Game via JS:", clicked);
  await page.waitForTimeout(2000);

  // Skip pre-dialogue
  await skipDialogue(page);
  await page.waitForTimeout(1000);
  console.log("✓ Dialogue skipped");
  await page.screenshot({ path: "/tmp/e2e5/01_ch01_start.png" });

  let st = await getState(page);
  console.log("Initial state:", st);

  // TURN 1: full sweep + play Kael
  console.log("\n=== TURN 1: hover sweep + Kael moves + attacks ===");
  let units = await findAllUnitsByHover(page);
  console.log(`Found ${units.size} unique units on hover`);
  for (const [n, pos] of units) console.log(`  ${pos.xp.toFixed(2)},${pos.yp.toFixed(2)} — ${n}`);

  // Click Kael (we know he's around 0.33, 0.60)
  const kaelEntry = [...units].find(([n]) => n.startsWith("Kael"));
  const borinEntry = [...units].find(([n]) => n.startsWith("Borin"));
  const serraEntry = [...units].find(([n]) => n.startsWith("Serra"));
  const lyraEntry = [...units].find(([n]) => n.startsWith("Lyra"));
  console.log("Kael entry:", kaelEntry ? "yes" : "no");
  console.log("Borin entry:", borinEntry ? "yes" : "no");
  console.log("Lyra entry:", lyraEntry ? "yes" : "no");

  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();

  async function clickUnitAt(pos, label) {
    await page.mouse.click(cbox.x + cbox.width * pos.xp, cbox.y + cbox.height * pos.yp);
    await page.waitForTimeout(600);
    const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
    const isGeneric = !panel || panel.includes("Click or hover");
    if (isGeneric) { fail(`Click at ${pos.xp.toFixed(2)},${pos.yp.toFixed(2)} did not select ${label}`); return null; }
    return panel.substring(0, 60).replace(/\n/g, " | ");
  }

  async function tryMoveTo(startPos, targetXp, targetYp) {
    // Click start unit
    await page.mouse.click(cbox.x + cbox.width * startPos.xp, cbox.y + cbox.height * startPos.yp);
    await page.waitForTimeout(500);
    // Check selection
    const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
    if (!panel || panel.includes("Click or hover")) return { ok: false, reason: "no unit selected" };
    // Click destination
    await page.mouse.click(cbox.x + cbox.width * targetXp, cbox.y + cbox.height * targetYp);
    await page.waitForTimeout(600);
    const menu = await page.locator(".action-menu").count();
    if (menu > 0) {
      // Click Wait (close menu)
      const waitBtn = page.locator('.action-menu button:has-text("Wait"), .action-menu button:has-text("等待")').first();
      if (await waitBtn.count() > 0) {
        await waitBtn.click();
        await page.waitForTimeout(500);
        return { ok: true, action: "moved+wait" };
      }
      // Otherwise try Attack
      const atkBtn = page.locator('.action-menu button:has-text("Attack"), .action-menu button:has-text("攻擊")').first();
      if (await atkBtn.count() > 0) {
        await atkBtn.click();
        await page.waitForTimeout(800);
        // Click on enemy (further right, around x=0.75)
        await page.mouse.click(cbox.x + cbox.width * 0.78, cbox.y + cbox.height * 0.50);
        await page.waitForTimeout(4000);
        return { ok: true, action: "moved+attacked" };
      }
    }
    return { ok: false, reason: "no action menu" };
  }

  // === Kael turn ===
  if (kaelEntry) {
    console.log("\n-- Kael action --");
    const [_, kaelPos] = kaelEntry;
    // Move Kael 4 tiles right (toward center)
    const r = await tryMoveTo(kaelPos, kaelPos.xp + 0.18, kaelPos.yp);
    console.log("Kael action result:", r);
  }

  // === Borin turn ===
  if (borinEntry) {
    console.log("\n-- Borin action --");
    const [_, borinPos] = borinEntry;
    const r = await tryMoveTo(borinPos, borinPos.xp + 0.15, borinPos.yp + 0.05);
    console.log("Borin action result:", r);
  }

  // === Serra turn ===
  if (serraEntry) {
    console.log("\n-- Serra action --");
    const [_, serraPos] = serraEntry;
    const r = await tryMoveTo(serraPos, serraPos.xp + 0.12, serraPos.yp);
    console.log("Serra action result:", r);
  }

  // === Lyra turn ===
  if (lyraEntry) {
    console.log("\n-- Lyra action --");
    const [_, lyraPos] = lyraEntry;
    const r = await tryMoveTo(lyraPos, lyraPos.xp + 0.10, lyraPos.yp - 0.05);
    console.log("Lyra action result:", r);
  }

  st = await getState(page);
  console.log("After all player actions:", st);
  await page.screenshot({ path: "/tmp/e2e5/02_turn1_done.png" });

  // === End Turn ===
  console.log("\n=== END TURN 1 ===");
  const endBtn = page.locator(".btn-end-turn");
  if (await endBtn.count() > 0) {
    await endBtn.click({ force: true });
    console.log("✓ End Turn clicked");
    // Wait for enemy turn to complete
    await page.waitForTimeout(15000);
    st = await getState(page);
    console.log("After enemy turn:", st);
    await page.screenshot({ path: "/tmp/e2e5/03_turn2_start.png" });
  } else {
    fail("End Turn button not found");
  }

  // === TURN 2: Kael again, more aggressive ===
  console.log("\n=== TURN 2: re-sweep + more combat ===");
  units = await findAllUnitsByHover(page);
  console.log(`Found ${units.size} unique units on hover`);
  for (const [n, pos] of units) console.log(`  ${pos.xp.toFixed(2)},${pos.yp.toFixed(2)} — ${n}`);

  const kael2 = [...units].find(([n]) => n.startsWith("Kael"));
  if (kael2) {
    const [_, kp] = kael2;
    console.log(`-- Kael T2 at ${kp.xp.toFixed(2)},${kp.yp.toFixed(2)} --`);
    const r = await tryMoveTo(kp, kp.xp + 0.20, kp.yp);
    console.log("Kael T2 result:", r);
  }

  // === End Turn 2 ===
  const endBtn2 = page.locator(".btn-end-turn");
  if (await endBtn2.count() > 0) {
    await endBtn2.click({ force: true });
    console.log("✓ End Turn 2 clicked");
    await page.waitForTimeout(15000);
    st = await getState(page);
    console.log("After enemy turn 2:", st);
    await page.screenshot({ path: "/tmp/e2e5/04_turn3_start.png" });
  }

  // === Watch combat log for damage numbers ===
  const log = await page.locator(".combat-log").textContent().catch(() => "");
  console.log("Combat log:", log?.substring(0, 500));

  // Summary
  console.log("\n=== ERRORS ===");
  console.log("pageerror:", pageErrors.length);
  console.log("console.error:", consoleErrors.length);
  for (const e of pageErrors.slice(0, 5)) console.log("  ", e.substring(0, 200));
  for (const e of consoleErrors.slice(0, 5)) console.log("  ", e.substring(0, 200));

  writeFileSync("/tmp/e2e5/errors.json", JSON.stringify({ pageErrors, consoleErrors, findings }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
