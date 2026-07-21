import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
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
// Check store state
const before = await page.evaluate(() => {
  const w = window;
  return { hasStore: !!w.__GAME_STORE__ };
});
console.log("BEFORE_END_TURN:", JSON.stringify(before));
const endBtn = await page.$('button:has-text("END TURN")');
console.log("END_BTN_FOUND:", !!endBtn);
if (endBtn) await endBtn.click({ force: true });
// Poll every 50ms for boss banner presence and check store via DOM
for (let i = 0; i < 30; i++) {
  const state = await page.evaluate(() => {
    const f = document.querySelector('.boss-flash');
    const b = document.querySelector('.boss-banner');
    const buttons = document.querySelectorAll('button');
    const perfNow = performance.now();
    return {
      perfNow,
      flashOpacity: f ? f.style.opacity : null,
      flashExists: !!f,
      bannerExists: !!b,
      bannerOpacity: b ? b.style.opacity : null,
      bannerText: b ? b.querySelector('.boss-name')?.textContent : null,
      bannerVisible: b ? window.getComputedStyle(b).opacity : null,
      bannerTop: b ? b.getBoundingClientRect().top : null,
      bannerAnim: b ? window.getComputedStyle(b).animationName : null,
      bannerAnimDur: b ? window.getComputedStyle(b).animationDuration : null,
      hasEndTurn: !!Array.from(buttons).find(b => b.textContent.includes('END TURN')),
    };
  });
  console.log(`t+${(i * 50).toString().padStart(4)}ms perf=${Math.floor(state.perfNow)}`, JSON.stringify({flash: state.flashOpacity, banner: state.bannerVisible, text: state.bannerText, animDur: state.bannerAnimDur}));
  if (state.bannerExists && parseFloat(state.bannerVisible) > 0.1) {
    await page.waitForTimeout(100);
    const detail = await page.evaluate(() => {
      const b = document.querySelector('.boss-banner');
      const f = document.querySelector('.boss-flash');
      const rect = b ? b.getBoundingClientRect() : null;
      const cs = b ? window.getComputedStyle(b) : null;
      const csf = f ? window.getComputedStyle(f) : null;
      return {
        rect: rect ? {x: rect.x, y: rect.y, w: rect.width, h: rect.height} : null,
        opacity: cs ? cs.opacity : null,
        animation: cs ? cs.animation : null,
        transform: cs ? cs.transform : null,
        zIndex: cs ? cs.zIndex : null,
        textContent: b ? b.textContent : null,
        parent: b ? b.parentElement?.tagName : null,
        flashOpacity: csf ? csf.opacity : null,
        flashAnim: csf ? csf.animation : null,
        flashBlend: csf ? csf.mixBlendMode : null,
        flashZ: csf ? csf.zIndex : null,
      };
    });
    console.log(`  >>> boss-banner detail:`, JSON.stringify(detail));
    // Check fonts and inner elements
    const inner = await page.evaluate(() => {
      const b = document.querySelector('.boss-banner');
      const name = document.querySelector('.boss-name');
      const tag = document.querySelector('.boss-tag');
      const csf = window.getComputedStyle(document.querySelector('.boss-banner'));
      const csn = name ? window.getComputedStyle(name) : null;
      const cst = tag ? window.getComputedStyle(tag) : null;
      return {
        banner: { fontFamily: csf.fontFamily, fontSize: csf.fontSize, color: csf.color },
        name: csn ? { fontSize: csn.fontSize, color: csn.color, display: csn.display, visibility: csn.visibility, opacity: csn.opacity } : null,
        tag: cst ? { fontSize: cst.fontSize, color: cst.color, display: cst.display, visibility: cst.visibility, opacity: cst.opacity } : null,
        nameHTML: name ? name.outerHTML.slice(0, 200) : null,
        nameRect: name ? name.getBoundingClientRect() : null,
      };
    });
    console.log(`  >>> inner:`, JSON.stringify(inner));
    // Check the actual painted pixels
    const px = await page.evaluate(() => {
      // Render the boss-banner to a canvas via html2canvas alternative
      // Just check the parent chain
      const b = document.querySelector('.boss-banner');
      const chain = [];
      let el = b;
      while (el && el !== document.body) {
        const cs = window.getComputedStyle(el);
        chain.push({
          tag: el.tagName,
          cls: el.className,
          opacity: cs.opacity,
          display: cs.display,
          visibility: cs.visibility,
          transform: cs.transform,
          mixBlend: cs.mixBlendMode,
          overflow: cs.overflow,
          zIndex: cs.zIndex,
        });
        el = el.parentElement;
      }
      return chain;
    });
    console.log(`  >>> parent chain:`, JSON.stringify(px, null, 2));
    await page.screenshot({ path: `/tmp/boss_poll_${i}.png` });
  }
  await page.waitForTimeout(50);
}
await page.screenshot({ path: "/tmp/boss_final.png" });
console.log("LOG TAIL:", logs.filter(l => l.includes('BossEntrance') || l.includes('error') || l.includes('pageerror')).slice(-20).join("\n"));
await browser.close();
