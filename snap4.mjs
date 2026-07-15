import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("ERR:", e.message));
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(4000);
const btns = await page.locator("button").all();
for (const b of btns) {
  const t = await b.innerText().catch(() => "");
  if (t && t.toLowerCase().includes("start")) { await b.click({force:true}); console.log("clicked"); break; }
}
await page.waitForTimeout(3500);
for (let i = 0; i < 4; i++) {
  await page.locator(".dialogue-box").click({ force: true });
  await page.waitForTimeout(800);
}
await page.screenshot({ path: "/tmp/kael_ranger.png", timeout: 60000, animations: "disabled" });
await browser.close();
console.log("done");
