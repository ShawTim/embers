import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e8", { recursive: true });

const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];
const consoleErrors = [];
const findings = [];
const dialogueLog = [];
let currentChapter = "ch01";

function note(s) { findings.push(`[${currentChapter}] ${s}`); console.log("  📝", s); }
function fail(s) { findings.push(`[${currentChapter}] ❌ ${s}`); console.log("  ❌", s); }

async function skipDialogue(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return true;
    // Capture dialogue text for plot check
    const txt = await page.locator(".dialogue-overlay .dialogue-text, .dialogue-overlay").first().textContent().catch(() => "");
    if (txt) dialogueLog.push(`[${currentChapter}] ${txt.substring(0, 80).replace(/\n/g, " ")}`);
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(250);
  }
  return false;
}

async function getState(page) {
  const turn = await page.locator(".turn-badge").textContent().catch(() => "?");
  const phase = await page.locator(".phase-badge").textContent().catch(() => "?");
  const counts = await page.locator(".unit-counts").textContent().catch(() => "?");
  const obj = await page.locator(".hud-top").textContent().catch(() => "");
  return { turn: turn?.trim(), phase: phase?.trim(), counts: counts?.trim(), obj: obj?.trim() };
}

async function endTurnMany(page, n, waitMs = 15000) {
  for (let i = 0; i < n; i++) {
    const st = await getState(page);
    if (st.phase?.toLowerCase().includes("victory") || st.phase?.toLowerCase().includes("defeat")) return i;
    if (await page.locator(".dialogue-overlay").count() > 0) return i;
    if (st.phase !== "Your Turn") { await page.waitForTimeout(2000); continue; }
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      await endBtn.click({ force: true });
      await page.waitForTimeout(waitMs);
    } else { return i; }
  }
  return n;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    pageErrors.push(`pageerror: ${e.message}`);
    console.log("[pageerror]", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(`console: ${m.text()}`);
      console.log("[console.error]", m.text());
    }
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);
  console.log("✓ Started");

  // Play through ch01-ch08 (or until defeat)
  for (let ch = 1; ch <= 8; ch++) {
    currentChapter = `ch${ch.toString().padStart(2, "0")}`;
    console.log(`\n========== ${currentChapter.toUpperCase()} ==========`);
    await skipDialogue(page);
    await page.waitForTimeout(1500);
    let st = await getState(page);
    console.log("State:", st);
    if (st.phase?.toLowerCase().includes("victory") || st.phase?.toLowerCase().includes("defeat")) {
      console.log(`${currentChapter} already ended: ${st.phase}`);
      break;
    }
    await page.screenshot({ path: `/tmp/e2e8/${currentChapter}_start.png` });

    // End turn many times
    const turns = await endTurnMany(page, 12, 12000);
    console.log(`${currentChapter} played ${turns} end-turns`);

    await page.screenshot({ path: `/tmp/e2e8/${currentChapter}_mid.png` });
    st = await getState(page);
    console.log("After end-turns:", st);
    const log = await page.locator(".combat-log").textContent().catch(() => "");
    console.log("Combat log:", log?.substring(0, 200));

    // Check for dialogue (victory or boss death)
    if (await page.locator(".dialogue-overlay").count() > 0) {
      console.log(`${currentChapter} dialogue shown — capturing`);
      await skipDialogue(page);
      await page.waitForTimeout(1500);
    }
  }

  // Final
  await page.screenshot({ path: "/tmp/e2e8/final.png" });
  st = await getState(page);
  console.log("\nFinal state:", st);

  console.log("\n=== SUMMARY ===");
  console.log("Dialogues seen:", dialogueLog.length);
  console.log("pageerror:", pageErrors.length);
  console.log("console.error:", consoleErrors.length);
  console.log("\n=== DIALOGUE PLOT LOG ===");
  for (const d of dialogueLog) console.log("  ", d);

  writeFileSync("/tmp/e2e8/dialogues.json", JSON.stringify(dialogueLog, null, 2));
  writeFileSync("/tmp/e2e8/errors.json", JSON.stringify({ pageErrors, consoleErrors, findings }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
