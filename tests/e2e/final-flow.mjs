import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000/";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];

page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
page.on("console", message => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some(button =>
      /Start Game|開始遊戲/.test(button.textContent || ""),
    ),
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find(candidate =>
      /Start Game|開始遊戲/.test(candidate.textContent || ""),
    );
    button?.click();
  });
  await page.waitForTimeout(800);

  const reachEpilogue = () => page.evaluate(() => {
    const store = window.__game;
    if (!store) throw new Error("Development game-store hook is unavailable");

    store.getState().initChapter(19);
    store.setState({ activeDialogue: null });
    const initial = store.getState();
    if (!initial.grid) throw new Error("Chapter 20 grid was not initialized");

    for (const unit of initial.units) {
      if (unit.faction !== "enemy") continue;
      unit.hp = 0;
      unit.isDead = true;
      initial.grid.removeUnit(unit);
    }
    store.setState({ units: [...initial.units] });

    const lord = store.getState().units.find(unit => unit.def.isLord && !unit.isDead);
    if (!lord) throw new Error("Chapter 20 has no living player lord");
    store.getState().selectUnit(lord);
    store.getState().confirmMove(lord.pos);

    const states = [{
      phase: store.getState().phase,
      dialogue: store.getState().activeDialogue,
    }];
    store.getState().clearDialogue();
    states.push({
      phase: store.getState().phase,
      dialogue: store.getState().activeDialogue,
    });
    store.getState().clearDialogue();
    states.push({
      phase: store.getState().phase,
      dialogue: store.getState().activeDialogue,
    });
    store.getState().clearDialogue();
    states.push({
      phase: store.getState().phase,
      dialogue: store.getState().activeDialogue,
    });
    return states;
  });

  const flow = await reachEpilogue();
  const expectedFlow = [
    { phase: "player", dialogue: "ch20_boss_death" },
    { phase: "victory", dialogue: "ch20_victory" },
    { phase: "victory", dialogue: "ch20_credits" },
    { phase: "epilogue", dialogue: null },
  ];
  if (JSON.stringify(flow) !== JSON.stringify(expectedFlow)) {
    throw new Error(`Unexpected final flow: ${JSON.stringify(flow)}`);
  }

  await page.waitForSelector(".outro-buttons .outro-btn", { timeout: 5_000 });
  await page.locator(".outro-buttons .outro-btn").nth(1).click();
  await page.waitForFunction(
    () => window.__game?.getState().chapter?.id === "ch01" && !!window.__game?.getState().grid,
    null,
    { timeout: 5_000 },
  );
  const replayed = await page.evaluate(() => ({
    titleVisible: !!document.querySelector(".start-screen"),
    chapterId: window.__game?.getState().chapter?.id ?? null,
    gold: window.__game?.getState().gold,
    convoySize: window.__game?.getState().convoy.length,
  }));
  if (replayed.titleVisible || replayed.chapterId !== "ch01" || replayed.gold !== 0 || replayed.convoySize !== 5) {
    throw new Error(`Play Again failed: ${JSON.stringify(replayed)}`);
  }

  const secondFlow = await reachEpilogue();
  if (JSON.stringify(secondFlow) !== JSON.stringify(expectedFlow)) {
    throw new Error(`Unexpected second final flow: ${JSON.stringify(secondFlow)}`);
  }

  await page.waitForSelector(".outro-btn-primary", { timeout: 5_000 });
  await page.locator(".outro-btn-primary").click();
  await page.waitForTimeout(300);

  const returned = await page.evaluate(() => ({
    titleVisible: !!document.querySelector(".start-screen"),
    chapterId: window.__game?.getState().chapter?.id ?? null,
    hasGrid: !!window.__game?.getState().grid,
  }));
  if (!returned.titleVisible || returned.chapterId !== null || returned.hasGrid) {
    throw new Error(`Return to Title failed: ${JSON.stringify(returned)}`);
  }
  if (errors.length > 0) {
    throw new Error(`Browser errors detected:\n${errors.join("\n")}`);
  }

  console.log("Final chapter flow passed:", JSON.stringify({ flow, replayed, returned }));
} finally {
  await browser.close();
}
