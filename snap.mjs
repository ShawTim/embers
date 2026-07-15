import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function main() {
  const url = process.argv[2] ?? "http://localhost:3000/";
  const out = process.argv[3] ?? "/tmp/landing.png";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(process.argv[4] ? Number(process.argv[4]) : 4500);
  await page.screenshot({ path: out, fullPage: false });
  writeFileSync("/tmp/landing-errors.txt", errors.join("\n"));
  console.log("OK", out, "errors=", errors.length);
  if (errors.length) {
    for (const e of errors.slice(0, 5)) console.log("  ", e);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
