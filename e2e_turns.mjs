import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e6", { recursive: true });

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

async function hoverAll(page) {
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  const found = new Map();
  // First move mouse to a known-empty spot to ensure stale hover cleared
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  for (let yp = 0.35; yp <= 0.90; yp += 0.05) {
    for (let xp = 0.10; xp <= 0.90; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(20);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 30).replace(/\n/g, " ");
        if (!found.has(name)) found.set(name, { xp, yp });
      }
    }
  }
  return { found, cbox };
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
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);
  await skipDialogue(page);
  await page.waitForTimeout(1000);
  console.log("✓ Started Ch01");
  await page.screenshot({ path: "/tmp/e2e6/01_start.png" });

  // Run 4 player turns cyclically: each turn click first player unit,
  // try move toward enemy, then click Wait/Attack.
  for (let turnNum = 1; turnNum <= 4; turnNum++) {
    console.log(`\n=== TURN ${turnNum} ===`);
    const st = await getState(page);
    console.log("State:", st);
    if (st.phase !== "Your Turn") {
      console.log("  not player turn, waiting...");
      await page.waitForTimeout(3000);
      continue;
    }

    const { found, cbox } = await hoverAll(page);
    console.log(`Found ${found.size} units`);
    // Sort by player first, then by name
    const players = [...found].filter(([n]) => n.includes("ALLY"));
    const enemies = [...found].filter(([n]) => !n.includes("ALLY"));
    console.log("Players:", players.map(p => p[0]).join(", "));
    console.log("Enemies:", enemies.map(p => p[0]).join(", "));

    // Pick first ALLY (filter to actual mesh hover positions, not stale)
    const [pName, pPos] = players[0] || [];
    if (!pName) { console.log("  no player visible"); continue; }
    console.log(`Acting as ${pName} at ${pPos.xp.toFixed(2)},${pPos.yp.toFixed(2)}`);

    // Move mouse TO the position first (to clear stale hover), then click
    await page.mouse.move(cbox.x + cbox.width * pPos.xp, cbox.y + cbox.height * pPos.yp);
    await page.waitForTimeout(200);
    // Click without moving mouse away
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
    if (!panel || panel.includes("Click or hover")) { fail(`Couldn't select ${pName}`); continue; }
    console.log(`  selected: ${panel.substring(0, 40)}`);

    // Try click 4-5 different positions to see if any shows action menu
    let actionShown = false;
    for (let i = 0; i < 8; i++) {
      const tx = pPos.xp + 0.05 * (i + 1);
      const ty = pPos.yp;
      if (tx > 0.95) break;
      await page.mouse.click(cbox.x + cbox.width * tx, cbox.y + cbox.height * ty);
      await page.waitForTimeout(400);
      const menu = await page.locator(".action-menu").count();
      if (menu > 0) {
        actionShown = true;
        console.log(`  action menu at tx=${tx.toFixed(2)}`);
        // Try Attack first
        const atk = page.locator('.action-menu button:has-text("Attack"), .action-menu button:has-text("攻擊")').first();
        if (await atk.count() > 0) {
          await atk.click();
          await page.waitForTimeout(800);
          // Click somewhere on the right half (enemy zone)
          await page.mouse.click(cbox.x + cbox.width * 0.78, cbox.y + cbox.height * 0.45);
          await page.waitForTimeout(5000);
          console.log("  attacked");
        } else {
          const wait = page.locator('.action-menu button:has-text("Wait"), .action-menu button:has-text("等待")').first();
          if (await wait.count() > 0) {
            await wait.click();
            console.log("  waited");
            await page.waitForTimeout(500);
          } else {
            // No buttons — close menu
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
          }
        }
        break;
      }
    }
    if (!actionShown) {
      console.log("  no action menu shown — deselect");
      // Click outside to deselect
      await page.mouse.click(cbox.x + cbox.width * 0.5, cbox.y + cbox.height * 0.1);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `/tmp/e2e6/t${turnNum}_after.png` });
  }

  // End turn
  console.log("\n=== END TURN ===");
  const endBtn = page.locator(".btn-end-turn");
  if (await endBtn.count() > 0) {
    await endBtn.click({ force: true });
    await page.waitForTimeout(20000);
    const st = await getState(page);
    console.log("After end:", st);
    await page.screenshot({ path: "/tmp/e2e6/after_end.png" });
  }

  // Watch combat log
  const log = await page.locator(".combat-log").textContent().catch(() => "");
  console.log("Combat log:", log?.substring(0, 600));

  // Final summary
  console.log("\n=== ERRORS ===");
  console.log("pageerror:", pageErrors.length);
  console.log("console.error:", consoleErrors.length);
  for (const e of pageErrors.slice(0, 5)) console.log("  ", e.substring(0, 250));
  for (const e of consoleErrors.slice(0, 5)) console.log("  ", e.substring(0, 250));

  writeFileSync("/tmp/e2e6/errors.json", JSON.stringify({ pageErrors, consoleErrors, findings }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
