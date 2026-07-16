import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

mkdirSync("/tmp/e2e_full", { recursive: true });
const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const REPORTS_DIR = "/tmp/e2e_full/reports";
mkdirSync(REPORTS_DIR, { recursive: true });

const allReports = {};
const allErrors = [];

async function skipDialogue(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) return true;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(200);
  }
  return false;
}

async function getState(page) {
  return {
    turn: (await page.locator(".turn-badge").textContent().catch(() => "?"))?.trim(),
    phase: (await page.locator(".phase-badge").textContent().catch(() => "?"))?.trim(),
    counts: (await page.locator(".unit-counts").textContent().catch(() => "?"))?.trim(),
    obj: (await page.locator(".objective").textContent().catch(() => "?"))?.trim(),
  };
}

async function endTurns(page, n, waitMs = 12000) {
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

async function playChapter(page, chNum, stats) {
  const chId = `ch${chNum.toString().padStart(2, "0")}`;
  console.log(`\n========== ${chId} ==========`);
  await skipDialogue(page);
  await page.waitForTimeout(1500);
  let st = await getState(page);
  console.log(`State: ${st.turn} | ${st.phase} | ${st.counts} | ${st.obj}`);
  await page.screenshot({ path: join(REPORTS_DIR, `${chId}_start.png`) });

  // Track metrics
  const chapterReport = {
    id: chId,
    num: chNum,
    startState: st,
    endState: null,
    turnsToComplete: 0,
    outcome: "ongoing",
    dialogueSeen: [],
    combatEvents: [],
    pageErrors: [],
  };

  // End turn loop
  let lastLog = "";
  for (let i = 0; i < 20; i++) {
    st = await getState(page);
    // Capture dialogue when shown
    if (await page.locator(".dialogue-overlay").count() > 0) {
      const txt = await page.locator(".dialogue-overlay .dialogue-text, .dialogue-overlay").first().textContent().catch(() => "");
      if (txt && txt !== lastLog) {
        chapterReport.dialogueSeen.push(txt.substring(0, 100).replace(/\n/g, " "));
        lastLog = txt;
      }
    }
    // Capture combat log
    const combatLog = await page.locator(".combat-log").textContent().catch(() => "");
    if (combatLog && combatLog.length > 5) {
      const events = combatLog.split("\n").map(s => s.trim()).filter(Boolean);
      for (const ev of events) {
        if (!chapterReport.combatEvents.includes(ev)) {
          chapterReport.combatEvents.push(ev);
        }
      }
    }

    if (st.phase?.toLowerCase().includes("victory")) {
      chapterReport.outcome = "victory";
      break;
    }
    if (st.phase?.toLowerCase().includes("defeat")) {
      chapterReport.outcome = "defeat";
      break;
    }
    if (await page.locator(".dialogue-overlay").count() > 0) {
      // Skip dialogue
      await skipDialogue(page);
      await page.waitForTimeout(1500);
      // Click "Next Chapter" button if present
      const nextChap = page.locator("button:has-text('Next Chapter'), button:has-text('下一章')");
      if (await nextChap.count() > 0) {
        await nextChap.click();
        await page.waitForTimeout(2000);
      }
      continue;
    }
    if (st.phase !== "Your Turn") { await page.waitForTimeout(2000); continue; }
    const endBtn = page.locator(".btn-end-turn");
    if (await endBtn.count() > 0 && await endBtn.isVisible()) {
      chapterReport.turnsToComplete++;
      await endBtn.click({ force: true });
      await page.waitForTimeout(12000);
    } else { break; }
  }

  chapterReport.endState = await getState(page);
  await page.screenshot({ path: join(REPORTS_DIR, `${chId}_end.png`) });
  allReports[chId] = chapterReport;
  writeFileSync(join(REPORTS_DIR, `${chId}.json`), JSON.stringify(chapterReport, null, 2));
  console.log(`${chId} result: ${chapterReport.outcome} | turns: ${chapterReport.turnsToComplete}`);
  return chapterReport;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { allErrors.push(`pageerror: ${e.message}`); console.log("[pageerror]", e.message); });
  page.on("console", (m) => { if (m.type() === "error") { allErrors.push(`console: ${m.text()}`); console.log("[console.error]", m.text()); } });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);

  // Play ch01-20
  for (let ch = 1; ch <= 20; ch++) {
    const r = await playChapter(page, ch, {});
    if (r.outcome === "defeat") {
      console.log(`Defeat at ch${ch} — stopping`);
      break;
    }
    if (ch === 1) {
      // Verify chapter transition
      const st = await getState(page);
      console.log(`Post ch01: ${st.turn} | ${st.phase} | ${st.counts}`);
    }
  }

  writeFileSync(join(REPORTS_DIR, "all.json"), JSON.stringify(allReports, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log("Chapters completed:", Object.keys(allReports).length);
  console.log("pageerror:", allErrors.filter(e => e.startsWith("pageerror")).length);
  console.log("console.error:", allErrors.filter(e => e.startsWith("console")).length);
  for (const e of allErrors.slice(0, 5)) console.log("  ", e.substring(0, 200));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
