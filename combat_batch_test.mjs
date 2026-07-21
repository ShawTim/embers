import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE: " + msg.text()); });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  }
});
await page.waitForTimeout(500);
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await (await page.$('.start-card button'))?.click();
await page.waitForTimeout(1500);
for (let i = 0; i < 20; i++) {
  const dca = await page.$('.dialogue-click-area');
  if (dca) await dca.click({ force: true });
  else break;
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);
// Click on Kael (a player unit) to select
await page.screenshot({ path: "/tmp/cb1_select.png" });
// Move Kael forward - need to find his tile
// Just end turn to start combat
const endBtn = await page.$('button:has-text("END TURN")');
if (endBtn) await endBtn.click({ force: true });
// Wait for boss cinematic
let waited = 0;
while (waited < 3000) {
  const state = await page.evaluate(() => {
    const b = document.querySelector('.boss-name');
    if (!b) return null;
    return { opacity: parseFloat(window.getComputedStyle(b).opacity) };
  });
  if (state && state.opacity > 0.9) {
    await page.screenshot({ path: "/tmp/cb2_boss.png" });
    break;
  }
  await page.waitForTimeout(50);
  waited += 50;
}
// Wait for enemy combat to happen
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/cb3_combat.png" });
// Wait for full enemy turn to complete
await page.waitForTimeout(15000);
await page.screenshot({ path: "/tmp/cb4_after.png" });
console.log("ERRORS:", errors.length, errors.slice(0, 5));
await browser.close();
