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
await page.waitForTimeout(2000);  // wait for BOSS intro cinematic
await page.screenshot({ path: "/tmp/polish_intro.png" });
await page.waitForTimeout(2000);  // let enemy turn finish
await page.screenshot({ path: "/tmp/polish_after.png" });
console.log("ERRORS:", errors.length, errors.slice(0, 10));
await browser.close();
