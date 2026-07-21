import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => console.log("ERROR:", e.message));
page.on("console", (m) => { if (m.text().includes("[BE]")) console.log("CONSOLE:", m.text()); });
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
const endBtn = await page.$('button:has-text("END TURN")');
if (endBtn) await endBtn.click({ force: true });
// Wait for banner to be at peak opacity
let waited = 0;
let found = false;
while (waited < 3000) {
  const state = await page.evaluate(() => {
    const b = document.querySelector('.boss-name');
    if (!b) return null;
    const cs = window.getComputedStyle(b);
    return { opacity: parseFloat(cs.opacity), text: b.textContent };
  });
  if (state && state.opacity > 0.9) {
    console.log(`FOUND at waited=${waited}ms opacity=${state.opacity}`);
    // Snap multiple times to catch different moments
    for (let s = 0; s < 3; s++) {
      await page.screenshot({ path: `/tmp/banner_moment_${s}.png` });
      const bbox = await page.evaluate(() => {
        const b = document.querySelector('.boss-banner');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      console.log(`  bbox moment ${s}:`, bbox);
      if (bbox) {
        await page.screenshot({ path: `/tmp/banner_only_${s}.png`, clip: { x: Math.max(0, bbox.x - 30), y: Math.max(0, bbox.y - 30), width: bbox.width + 60, height: bbox.height + 60 } });
      }
      await page.waitForTimeout(150);
    }
    found = true;
    break;
  }
  await page.waitForTimeout(50);
  waited += 50;
}
if (!found) console.log("BANNER NEVER FOUND");
await browser.close();
