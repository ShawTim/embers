import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const startBtn = page.getByText('Begin the March').or(page.getByText('Begin').or(page.getByText('Start')));
if (await startBtn.count() > 0) {
  await startBtn.first().click({ force: true }).catch(() => {});
}
await page.waitForTimeout(2500);

// Try to grab the actual rendered vertex shader source
const shaders = await page.evaluate(() => {
  const out = [];
  // Try to walk WebGL programs to find compiled shaders
  // (this won't work directly but at least we can introspect via gl)
  const c = document.querySelector('canvas');
  if (!c) return 'no canvas';
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'no gl';
  // Iterate programs via gl.getParameter
  // (unreliable but at least lets us see what's going on)
  const programs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
  return { programs };
});
console.log(JSON.stringify(shaders));

await browser.close();
