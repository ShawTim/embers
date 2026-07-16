import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e11", { recursive: true });
const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];

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

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("Start Game"));
    if (btn) (btn).click();
  });
  await page.waitForTimeout(2000);
  await skipDialogue(page);
  await page.waitForTimeout(1500);

  // Find Kael + Garrick by hover
  const canvas = page.locator("canvas").first();
  const cbox = await canvas.boundingBox();
  const found = new Map();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  for (let yp = 0.30; yp <= 0.95; yp += 0.05) {
    for (let xp = 0.05; xp <= 0.95; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(15);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 40).replace(/\n/g, " ");
        if (!found.has(name)) found.set(name, { xp, yp });
      }
    }
  }
  console.log("Units on ch01 start:");
  for (const [n, p] of found) console.log(`  ${p.xp.toFixed(2)},${p.yp.toFixed(2)} — ${n}`);

  const kael = [...found].find(([n]) => n.startsWith("Kael"));
  const garrick = [...found].find(([n]) => n.toLowerCase().includes("garrick"));
  const borin = [...found].find(([n]) => n.startsWith("Borin"));
  console.log("Kael:", kael?.[1]);
  console.log("Borin:", borin?.[1]);
  console.log("Garrick:", garrick?.[1]);

  // Click Kael + try move toward garrick
  if (kael && garrick) {
    const [_, kp] = kael;
    // Move Kael to (6, 7) — between player and garrick
    const targetX = 0.55; // somewhere between left and garrick
    const targetY = kp.yp;
    await page.mouse.move(cbox.x + cbox.width * kp.xp, cbox.y + cbox.height * kp.yp);
    await page.waitForTimeout(200);
    await page.mouse.click(cbox.x + cbox.width * kp.xp, cbox.y + cbox.height * kp.yp);
    await page.waitForTimeout(500);
    // Try clicking multiple positions to see action menu
    for (let i = 1; i <= 6; i++) {
      const tx = kp.xp + 0.04 * i;
      const ty = kp.yp;
      await page.mouse.click(cbox.x + cbox.width * tx, cbox.y + cbox.height * ty);
      await page.waitForTimeout(400);
      const menu = await page.locator(".action-menu").count();
      if (menu > 0) {
        console.log(`Action menu at tx=${tx.toFixed(2)}`);
        const atk = page.locator('.action-menu button:has-text("Attack"), .action-menu button:has-text("攻擊")').first();
        if (await atk.count() > 0) {
          await atk.click();
          await page.waitForTimeout(800);
          // Click on garrick
          const [__, gp] = garrick;
          await page.mouse.click(cbox.x + cbox.width * gp.xp, cbox.y + cbox.height * gp.yp);
          await page.waitForTimeout(5000);
          console.log("Attacked garrick");
          await page.screenshot({ path: "/tmp/e2e11/after_attack.png" });
        } else {
          const wait = page.locator('.action-menu button:has-text("Wait"), .action-menu button:has-text("等待")').first();
          if (await wait.count() > 0) await wait.click();
        }
        break;
      }
    }
  }

  // End turn many times
  for (let i = 0; i < 15; i++) {
    const end = page.locator(".btn-end-turn");
    if (await end.count() > 0 && await end.isVisible()) {
      await end.click({ force: true });
      await page.waitForTimeout(15000);
    }
    if (await page.locator(".dialogue-overlay").count() > 0) {
      console.log("dialogue at iter", i);
      await skipDialogue(page);
      await page.waitForTimeout(1500);
    }
    const counts = await page.locator(".unit-counts").textContent().catch(() => "");
    const turn = await page.locator(".turn-badge").textContent().catch(() => "");
    if (i % 3 === 0) console.log(`  iter ${i}: ${turn} ${counts}`);
    if (counts?.includes("· 0 enemies") || counts?.includes("0/0 ready")) break;
  }

  // Look for Next Chapter button
  const nextChap = page.locator("button:has-text('Next Chapter'), button:has-text('下一章')");
  if (await nextChap.count() > 0) {
    console.log("Clicking Next Chapter");
    await nextChap.click();
    await page.waitForTimeout(2000);
  }
  if (await page.locator(".dialogue-overlay").count() > 0) {
    await skipDialogue(page);
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "/tmp/e2e11/ch02_start.png" });

  // Check ch02 state
  const turn2 = await page.locator(".turn-badge").textContent();
  const counts2 = await page.locator(".unit-counts").textContent();
  const obj2 = await page.locator(".objective").textContent();
  console.log("\nch02 state:", turn2, counts2, "obj:", obj2);

  // Hover sweep
  const found2 = new Map();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  for (let yp = 0.30; yp <= 0.95; yp += 0.05) {
    for (let xp = 0.05; xp <= 0.95; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * yp);
      await page.waitForTimeout(15);
      const panel = await page.locator(".unit-panel").first().textContent().catch(() => "");
      if (panel && !panel.includes("Click or hover") && panel.length > 8) {
        const name = panel.substring(0, 40).replace(/\n/g, " ");
        if (!found2.has(name)) found2.set(name, { xp, yp });
      }
    }
  }
  console.log("\nCh02 units:");
  for (const [n, p] of found2) console.log(`  ${p.xp.toFixed(2)},${p.yp.toFixed(2)} — ${n}`);
  const hasCultCaptain = [...found2.keys()].some(k => k.toLowerCase().includes("cult captain"));
  const hasGarrick = [...found2.keys()].some(k => k.toLowerCase().includes("garrick"));
  console.log("\nCult Captain:", hasCultCaptain, "Garrick:", hasGarrick);

  console.log("\npageerror:", pageErrors.length);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
