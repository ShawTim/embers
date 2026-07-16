import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("/tmp/e2e4", { recursive: true });

const URL = "http://localhost:3000/";
const VIEW = { width: 1280, height: 720 };
const pageErrors = [];
const consoleErrors = [];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    const rec = `pageerror: ${e.message}\n${e.stack || "(no stack)"}`;
    pageErrors.push(rec);
    console.log("[pageerror]", e.message);
    if (e.stack) console.log("  at", e.stack.split("\n").slice(0, 3).join("\n  "));
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const rec = `console: ${m.text()}\n${m.location ? `  at ${m.location.url}:${m.location.lineNumber}` : ""}`;
      consoleErrors.push(rec);
      console.log("[console.error]", m.text());
      if (m.location) console.log("  at", `${m.location.url}:${m.location.lineNumber}`);
    }
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const btn = page.locator('button:has-text("Start Game")').first();
  const box = await btn.boundingBox();
  console.log("Start Game button box:", box);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await btn.click({ timeout: 5000 });
  }
  await page.waitForTimeout(1500);
  // Skip dialogue
  for (let i = 0; i < 20; i++) {
    if (await page.locator(".dialogue-overlay").count() === 0) break;
    await page.locator(".dialogue-overlay").click({ force: true });
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);

  // Move mouse around the map to trigger all the brawl code paths
  const cbox = await page.locator("canvas").first().boundingBox();
  for (let r = 0; r < 3; r++) {
    for (let xp = 0.1; xp <= 0.9; xp += 0.05) {
      await page.mouse.move(cbox.x + cbox.width * xp, cbox.y + cbox.height * 0.5);
      await page.waitForTimeout(20);
    }
  }
  // Click around to trigger combat code paths
  for (let xp = 0.4; xp <= 0.85; xp += 0.05) {
    await page.mouse.click(cbox.x + cbox.width * xp, cbox.y + cbox.height * 0.5);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2000);

  // Click end turn to fire enemy AI
  const endTurn = page.locator(".btn-end-turn");
  if (await endTurn.count() > 0) {
    await endTurn.click({ force: true });
    await page.waitForTimeout(8000);
  }

  // Let some animations play
  await page.waitForTimeout(2000);

  writeFileSync("/tmp/e2e4/pageerrors.txt", pageErrors.join("\n\n"));
  writeFileSync("/tmp/e2e4/consoleerrors.txt", consoleErrors.join("\n\n"));
  console.log("\n=== SUMMARY ===");
  console.log("pageerror:", pageErrors.length);
  console.log("console.error:", consoleErrors.length);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
