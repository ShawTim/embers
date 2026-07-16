import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

mkdirSync("/tmp/e2e_smart", { recursive: true });
const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const REPORTS_DIR = "/tmp/e2e_smart/reports";
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

// Find all units by hover, return Map<name, {xp, yp, isPlayer}>
async function findUnits(page) {
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  const found = new Map();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  for (let yp = 0.30; yp <= 0.95; yp += 0.04) {
    for (let xp = 0.05; xp <= 0.95; xp += 0.04) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(12);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 40).replace(/\n/g, " ");
        const isPlayer = name.includes("ALLY") || name.includes("Kael") || name.includes("Lyra") || name.includes("Borin") || name.includes("Serra") || name.includes("Maren") || name.includes("Darius") || name.includes("Yuki");
        const isBoss = name.includes("Boss") || name.toLowerCase().includes("garrick") || name.toLowerCase().includes("veyne") || name.toLowerCase().includes("captain") || name.toLowerCase().includes("malachar") || name.toLowerCase().includes("zethar");
        if (!found.has(name)) found.set(name, { xp, yp, isPlayer, isBoss });
      }
    }
  }
  return { found, cbox };
}

async function moveAndAttack(page, cbox, playerPos, enemyPos) {
  // Click player
  await page.mouse.click(cbox.x + cbox.width * playerPos.xp, cbox.y + cbox.height * playerPos.yp);
  await page.waitForTimeout(500);
  const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
  if (!panel || panel.includes("Click or hover")) return { ok: false, reason: "no unit selected" };
  // Click enemy directly (try several positions)
  for (let dx = -0.03; dx <= 0.10; dx += 0.025) {
    for (let dy = -0.04; dy <= 0.04; dy += 0.02) {
      const tx = enemyPos.xp + dx;
      const ty = enemyPos.yp + dy;
      if (tx < 0.05 || tx > 0.95 || ty < 0.30 || ty > 0.95) continue;
      await page.mouse.click(cbox.x + cbox.width * tx, cbox.y + cbox.height * ty);
      await page.waitForTimeout(300);
      const menu = await page.locator(".action-menu").count();
      if (menu > 0) {
        // Click Attack
        const atk = page.locator('.action-menu button:has-text("Attack"), .action-menu button:has-text("攻擊")').first();
        if (await atk.count() > 0) {
          await atk.click();
          await page.waitForTimeout(800);
          // Click enemy
          await page.mouse.click(cbox.x + cbox.width * enemyPos.xp, cbox.y + cbox.height * enemyPos.yp);
          await page.waitForTimeout(5000);
          return { ok: true, action: "attacked" };
        } else {
          // Try Wait
          const wait = page.locator('.action-menu button:has-text("Wait"), .action-menu button:has-text("等待")').first();
          if (await wait.count() > 0) {
            await wait.click();
            await page.waitForTimeout(300);
            return { ok: true, action: "waited" };
          }
        }
      }
    }
  }
  return { ok: false, reason: "no action menu" };
}

async function playChapter(page, chNum) {
  const chId = `ch${chNum.toString().padStart(2, "0")}`;
  console.log(`\n========== ${chId} ==========`);
  await skipDialogue(page);
  await page.waitForTimeout(1500);
  const startState = await getState(page);
  console.log(`Start: ${startState.turn} | ${startState.phase} | ${startState.counts} | ${startState.obj}`);
  await page.screenshot({ path: join(REPORTS_DIR, `${chId}_start.png`) });

  const report = {
    id: chId, num: chNum, startState, endState: null, outcome: "ongoing",
    turnsToComplete: 0, aiSteps: 0, dialogueSeen: [], combatEvents: [],
    playerActions: [], enemyActions: [],
  };

  let lastLog = "";
  for (let i = 0; i < 30; i++) {
    const st = await getState(page);
    // Dialogue handling
    if (await page.locator(".dialogue-overlay").count() > 0) {
      const txt = await page.locator(".dialogue-overlay .dialogue-text, .dialogue-overlay").first().textContent().catch(() => "");
      if (txt && txt !== lastLog) {
        report.dialogueSeen.push(txt.substring(0, 100).replace(/\n/g, " "));
        lastLog = txt;
      }
      // Try to advance dialogue
      await skipDialogue(page);
      await page.waitForTimeout(1500);
      // Check for Next Chapter button
      const nextChap = page.locator("button:has-text('Next Chapter'), button:has-text('下一章')");
      if (await nextChap.count() > 0) {
        await nextChap.click();
        await page.waitForTimeout(2000);
      }
      continue;
    }
    if (st.phase?.toLowerCase().includes("victory")) {
      report.outcome = "victory";
      break;
    }
    if (st.phase?.toLowerCase().includes("defeat")) {
      report.outcome = "defeat";
      break;
    }
    if (st.phase !== "Your Turn") { await page.waitForTimeout(2000); continue; }

    // Player turn: find player + enemy, attack
    const { found, cbox } = await findUnits(page);
    const players = [...found].filter(([n, p]) => p.isPlayer);
    const enemies = [...found].filter(([n, p]) => !p.isPlayer);
    if (!players.length || !enemies.length) {
      // No units visible — just end turn
      const endBtn = page.locator(".btn-end-turn");
      if (await endBtn.count() > 0 && await endBtn.isVisible()) {
        await endBtn.click({ force: true });
        await page.waitForTimeout(12000);
        report.turnsToComplete++;
      }
      continue;
    }
    // Pick first player (or strongest — first found)
    const [pName, pPos] = players[0];
    // Pick first enemy
    const [eName, ePos] = enemies[0];
    const r = await moveAndAttack(page, cbox, pPos, ePos);
    report.playerActions.push({ turn: i, pName, eName, result: r });
    report.aiSteps++;
    if (!r.ok) {
      // Couldn't move/attack — just end turn
      const endBtn = page.locator(".btn-end-turn");
      if (await endBtn.count() > 0 && await endBtn.isVisible()) {
        await endBtn.click({ force: true });
        report.turnsToComplete++;
        await page.waitForTimeout(12000);
      }
    } else {
      // Action succeeded, end turn
      const endBtn = page.locator(".btn-end-turn");
      if (await endBtn.count() > 0 && await endBtn.isVisible()) {
        await endBtn.click({ force: true });
        report.turnsToComplete++;
        await page.waitForTimeout(12000);
      }
    }
  }

  report.endState = await getState(page);
  await page.screenshot({ path: join(REPORTS_DIR, `${chId}_end.png`) });
  allReports[chId] = report;
  writeFileSync(join(REPORTS_DIR, `${chId}.json`), JSON.stringify(report, null, 2));
  console.log(`${chId} result: ${report.outcome} | turns: ${report.turnsToComplete} | actions: ${report.aiSteps}`);
  return report;
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

  for (let ch = 1; ch <= 20; ch++) {
    const r = await playChapter(page, ch);
    if (r.outcome === "defeat") {
      console.log(`Defeat at ch${ch} — stopping`);
      break;
    }
  }

  writeFileSync(join(REPORTS_DIR, "all.json"), JSON.stringify(allReports, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log("Chapters:", Object.keys(allReports).map(k => `${k}:${allReports[k].outcome}`).join(", "));
  console.log("pageerror:", allErrors.filter(e => e.startsWith("pageerror")).length);
  console.log("console.error:", allErrors.filter(e => e.startsWith("console")).length);
  for (const e of allErrors.slice(0, 10)) console.log("  ", e.substring(0, 200));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
