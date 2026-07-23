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
  await page.waitForFunction(
    () => window.__game?.getState().chapter?.id === "ch01",
    null,
    { timeout: 5_000 },
  );

  const expected = await page.evaluate(() => {
    const store = window.__game;
    if (!store) throw new Error("Development game-store hook is unavailable");
    store.setState({ activeDialogue: null });
    const state = store.getState();
    if (!state.grid) throw new Error("Chapter 1 grid was not initialized");

    const kael = state.units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    kael.level = 12;
    kael.exp = 47;
    kael.stats.str = 19;
    kael.maxHp = 34;
    kael.hp = 1;
    kael.weapons[0].uses = 17;
    kael.equippedWeapon = kael.weapons[0];
    store.getState().useItemAction("master_seal", kael.uid);

    const promotedClassId = kael.classDef.id;
    const equippedWeaponId = kael.equippedWeapon?.id ?? null;
    const lyra = state.units.find(unit => unit.def.id === "lyra");
    if (!lyra?.equippedWeapon) throw new Error("Lyra was not deployed with a staff");
    lyra.equippedWeapon.uses = 1;
    kael.hp = Math.max(1, kael.maxHp - 3);
    store.setState({
      selectedUnit: lyra,
      pendingMove: { ...lyra.pos },
      selectionMode: "actionMenu",
    });
    store.getState().healTarget(kael);
    if (lyra.weapons.length !== 0 || lyra.equippedWeapon !== null) {
      throw new Error("Staff did not break after its final use");
    }

    for (const unit of state.units) {
      if (unit.faction !== "enemy") continue;
      unit.hp = 0;
      unit.isDead = true;
      state.grid.removeUnit(unit);
    }
    store.setState({ units: [...state.units] });

    const triggerUnit = store.getState().units.find(unit =>
      unit.faction === "player" && !unit.isDead && !unit.hasActed,
    );
    if (!triggerUnit) throw new Error("No player unit can trigger the victory check");
    store.getState().selectUnit(triggerUnit);
    store.getState().confirmMove(triggerUnit.pos);
    if (store.getState().activeDialogue !== "ch01_boss_death") {
      throw new Error(`Boss-death dialogue did not open: ${store.getState().activeDialogue}`);
    }
    store.getState().clearDialogue();
    if (store.getState().phase !== "victory") {
      throw new Error(`Chapter 1 did not enter victory: ${store.getState().phase}`);
    }
    store.getState().clearDialogue();

    return {
      uid: kael.uid,
      level: kael.level,
      exp: kael.exp,
      str: kael.stats.str,
      maxHp: kael.maxHp,
      classId: promotedClassId,
      equippedWeaponId,
      weaponUses: kael.equippedWeapon?.uses ?? null,
      lyraUid: lyra.uid,
    };
  });

  await page.locator(".victory-shop-btn").click();
  await page.locator(".shop-card").waitFor({ state: "visible", timeout: 5_000 });

  const shopBefore = await page.evaluate(() => ({
    gold: window.__game?.getState().gold ?? null,
    steelSwords: window.__game?.getState().convoy.filter(item => item.id === "steel_sword").length ?? null,
  }));
  if (shopBefore.gold !== 500 || shopBefore.steelSwords !== 1) {
    throw new Error(`Unexpected chapter reward before shopping: ${JSON.stringify(shopBefore)}`);
  }

  await page.locator('[data-shop-item="master_seal"] .shop-buy-btn').click();
  await page.locator(".shop-feedback.failure").waitFor({ state: "visible", timeout: 2_000 });
  const afterRejectedPurchase = await page.evaluate(() => ({
    gold: window.__game?.getState().gold ?? null,
    masterSeals: window.__game?.getState().convoy.filter(item => item.id === "master_seal").length ?? null,
  }));
  if (afterRejectedPurchase.gold !== 500 || afterRejectedPurchase.masterSeals !== 0) {
    throw new Error(`Unaffordable purchase changed state: ${JSON.stringify(afterRejectedPurchase)}`);
  }

  await page.locator('[data-shop-item="steel_sword"] .shop-buy-btn').click();
  await page.waitForTimeout(100);
  const shopAfter = await page.evaluate(() => ({
    gold: window.__game?.getState().gold ?? null,
    steelSwords: window.__game?.getState().convoy.filter(item => item.id === "steel_sword").length ?? null,
  }));
  if (shopAfter.gold !== 0 || shopAfter.steelSwords !== 2) {
    throw new Error(`Shop purchase failed: ${JSON.stringify(shopAfter)}`);
  }
  await page.locator(".shop-close").click();

  const nextChapterButton = page.locator("button").filter({ hasText: /Next Chapter|下一章/ });
  await nextChapterButton.waitFor({ state: "visible", timeout: 5_000 });
  await nextChapterButton.click();
  await page.waitForFunction(
    () => window.__game?.getState().chapter?.id === "ch02",
    null,
    { timeout: 5_000 },
  );

  const actual = await page.evaluate(() => {
    const state = window.__game?.getState();
    const kael = state?.units.find(unit => unit.def.id === "kael");
    const lyra = state?.units.find(unit => unit.def.id === "lyra");
    return {
      chapterId: state?.chapter?.id ?? null,
      uid: kael?.uid ?? null,
      level: kael?.level ?? null,
      exp: kael?.exp ?? null,
      str: kael?.stats.str ?? null,
      hp: kael?.hp ?? null,
      maxHp: kael?.maxHp ?? null,
      classId: kael?.classDef.id ?? null,
      equippedWeaponId: kael?.equippedWeapon?.id ?? null,
      weaponUses: kael?.equippedWeapon?.uses ?? null,
      gold: state?.gold ?? null,
      steelSwords: state?.convoy.filter(item => item.id === "steel_sword").length ?? null,
      lyraUid: lyra?.uid ?? null,
      lyraWeaponCount: lyra?.weapons.length ?? null,
    };
  });

  const expectedActual = {
    chapterId: "ch02",
    uid: expected.uid,
    level: expected.level,
    exp: expected.exp,
    str: expected.str,
    hp: expected.maxHp,
    maxHp: expected.maxHp,
    classId: expected.classId,
    equippedWeaponId: expected.equippedWeaponId,
    weaponUses: expected.weaponUses,
    gold: 0,
    steelSwords: 2,
    lyraUid: expected.lyraUid,
    lyraWeaponCount: 0,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expectedActual)) {
    throw new Error(
      `Campaign progression mismatch:\nexpected ${JSON.stringify(expectedActual)}\nactual   ${JSON.stringify(actual)}`,
    );
  }
  if (errors.length > 0) {
    throw new Error(`Browser errors detected:\n${errors.join("\n")}`);
  }

  console.log("Campaign transition passed:", JSON.stringify(actual));
} finally {
  await browser.close();
}
