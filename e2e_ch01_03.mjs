import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e7", { recursive: true });

const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];
const consoleErrors = [];
const findings = [];

function note(s) { findings.push(s); console.log("  📝", s); }
function fail(s) { findings.push("❌ " + s); console.log("  ❌", s); }

async function skipDialogue(page) {
  for (let i = 0; i < 60; i++) {
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

  // === START GAME ===
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);
  console.log("✓ Started game");

  // === CH01 ===
  console.log("\n=== CH01: Prologue ===");
  await skipDialogue(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/e2e7/ch01_start.png" });
  let st = await getState(page);
  console.log("Ch01 state:", st);
  if (st.phase !== "Your Turn") fail("Ch01 not in Your Turn after dialogue");
  else console.log("✓ Ch01 ready");

  // Quick play: just click End Turn several times to see enemy turn and combat
  for (let i = 0; i < 2; i++) {
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      console.log("  click End Turn", i + 1);
      await endBtn.click({ force: true });
      await page.waitForTimeout(20000);
    }
  }
  await page.screenshot({ path: "/tmp/e2e7/ch01_turn3.png" });
  st = await getState(page);
  console.log("Ch01 after 2 end turns:", st);
  const log = await page.locator(".combat-log").textContent().catch(() => "");
  console.log("Combat log:", log?.substring(0, 300));

  // === CH02: Forest of Whispers ===
  console.log("\n=== CH02: Forest of Whispers ===");
  // We need to defeat Garrick. Let's see if victory triggered already
  if (await page.locator(".dialogue-overlay").count() > 0) {
    console.log("  Dialogue showing — must be victory/boss death");
    await skipDialogue(page);
    await page.waitForTimeout(2000);
  }
  st = await getState(page);
  console.log("After ch01 finish:", st);
  if (st.turn?.includes("Turn 3") || st.turn?.includes("Turn 4")) {
    fail("Ch01 not yet finished after 2 end turns (garrick not killed yet)");
  }

  // Continue end turn until victory
  for (let i = 0; i < 5; i++) {
    st = await getState(page);
    if (st.phase === "victory" || st.phase?.includes("Victory") || await page.locator(".dialogue-overlay").count() > 0) break;
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      console.log(`  ch01 end turn ${i + 3}`);
      await endBtn.click({ force: true });
      await page.waitForTimeout(20000);
    }
  }
  await page.screenshot({ path: "/tmp/e2e7/ch01_finish.png" });

  // After ch01 victory, ch02 should auto-start
  await skipDialogue(page);
  await page.waitForTimeout(2000);
  st = await getState(page);
  console.log("After ch01 victory dialog:", st);
  await page.screenshot({ path: "/tmp/e2e7/ch02_start.png" });

  // === CH02 PLAY ===
  for (let i = 0; i < 8; i++) {
    st = await getState(page);
    if (st.phase?.includes("victory") || await page.locator(".dialogue-overlay").count() > 0) break;
    if (st.phase !== "Your Turn") { await page.waitForTimeout(2000); continue; }
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      console.log(`  ch02 end turn ${i + 1}`);
      await endBtn.click({ force: true });
      await page.waitForTimeout(15000);
    } else { break; }
  }
  await page.screenshot({ path: "/tmp/e2e7/ch02_finish.png" });
  st = await getState(page);
  console.log("Ch02 state:", st);
  const log2 = await page.locator(".combat-log").textContent().catch(() => "");
  console.log("Ch02 combat log:", log2?.substring(0, 300));

  // After ch02 victory, ch03 should auto-start
  if (await page.locator(".dialogue-overlay").count() > 0) await skipDialogue(page);
  await page.waitForTimeout(2000);

  // === CH03 PLAY ===
  console.log("\n=== CH03: The Forsaken Shrine ===");
  await page.screenshot({ path: "/tmp/e2e7/ch03_start.png" });
  for (let i = 0; i < 8; i++) {
    st = await getState(page);
    if (st.phase?.includes("victory") || await page.locator(".dialogue-overlay").count() > 0) break;
    if (st.phase !== "Your Turn") { await page.waitForTimeout(2000); continue; }
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      console.log(`  ch03 end turn ${i + 1}`);
      await endBtn.click({ force: true });
      await page.waitForTimeout(15000);
    } else { break; }
  }
  await page.screenshot({ path: "/tmp/e2e7/ch03_finish.png" });
  st = await getState(page);
  console.log("Ch03 state:", st);

  // === Summary ===
  console.log("\n=== ERRORS ===");
  console.log("pageerror:", pageErrors.length);
  console.log("console.error:", consoleErrors.length);
  for (const e of pageErrors.slice(0, 5)) console.log("  ", e.substring(0, 250));
  for (const e of consoleErrors.slice(0, 5)) console.log("  ", e.substring(0, 250));

  writeFileSync("/tmp/e2e7/errors.json", JSON.stringify({ pageErrors, consoleErrors, findings }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
