import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE: " + msg.text()); });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await (await page.$('.start-card button'))?.click();
await page.waitForTimeout(1500);
for (let i = 0; i < 15; i++) {
  const dca = await page.$('.dialogue-click-area');
  if (dca) await dca.click({ force: true });
  else { const ov = await page.$('.dialogue-overlay'); if (ov) await ov.click({ force: true }); else break; }
  await page.waitForTimeout(350);
}
await page.waitForTimeout(1500);
// End turn to trigger enemy turn
const endBtn = await page.$('button:has-text("END TURN")');
if (endBtn) await endBtn.click({ force: true });
// Snap during boss cinematic
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/boss_1.png" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/boss_2.png" });
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/boss_3.png" });
// After cinematic
await page.waitForTimeout(8000);
await page.screenshot({ path: "/tmp/after_enemy.png" });
console.log("ERRORS:", errors.length, errors.slice(0, 10));
await browser.close();
