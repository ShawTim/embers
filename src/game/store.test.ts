import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGame } from "./store";
import { CLASSES, WEAPONS } from "../data/gameData";

function dismissPreBattleDialogue() {
  useGame.setState({ activeDialogue: null });
}

function removeAllEnemies() {
  const state = useGame.getState();
  if (!state.grid) throw new Error("Chapter grid is not initialized");
  for (const unit of state.units) {
    if (unit.faction !== "enemy") continue;
    unit.hp = 0;
    unit.isDead = true;
    state.grid.removeUnit(unit);
  }
  useGame.setState({ units: [...state.units] });
}

function triggerBattleEndCheck() {
  const state = useGame.getState();
  const unit = state.units.find(candidate => candidate.faction === "player" && !candidate.isDead);
  if (!unit) throw new Error("No living player unit available");
  state.selectUnit(unit);
  state.confirmMove(unit.pos);
}

beforeEach(() => {
  localStorage.clear();
  useGame.getState().returnToTitle();
});

describe("game store chapter completion", () => {
  it("plays boss-death dialogue once, then transitions to victory", () => {
    useGame.getState().initChapter(0);
    dismissPreBattleDialogue();
    removeAllEnemies();

    const startingGold = useGame.getState().gold;
    const startingSteelSwords = useGame.getState().convoy.filter(item => item.id === "steel_sword").length;

    triggerBattleEndCheck();
    expect(useGame.getState().phase).toBe("player");
    expect(useGame.getState().activeDialogue).toBe("ch01_boss_death");

    useGame.getState().clearDialogue();
    expect(useGame.getState().phase).toBe("victory");
    expect(useGame.getState().activeDialogue).toBe("ch01_victory");
    expect(useGame.getState().gold).toBe(startingGold + 500);
    expect(useGame.getState().convoy.filter(item => item.id === "steel_sword")).toHaveLength(startingSteelSwords + 1);

    useGame.getState().clearDialogue();
    expect(useGame.getState().activeDialogue).toBeNull();

    const rewardedGold = useGame.getState().gold;
    useGame.setState({ phase: "player" });
    triggerBattleEndCheck();
    expect(useGame.getState().activeDialogue).toBeNull();
    expect(useGame.getState().gold).toBe(rewardedGold);
  });

  it("chains ch20 boss death through victory, credits, and epilogue", () => {
    useGame.getState().initChapter(19);
    dismissPreBattleDialogue();
    removeAllEnemies();

    triggerBattleEndCheck();
    expect(useGame.getState().activeDialogue).toBe("ch20_boss_death");

    useGame.getState().clearDialogue();
    expect(useGame.getState().phase).toBe("victory");
    expect(useGame.getState().activeDialogue).toBe("ch20_victory");

    useGame.getState().clearDialogue();
    expect(useGame.getState().activeDialogue).toBe("ch20_credits");

    useGame.getState().clearDialogue();
    expect(useGame.getState().phase).toBe("epilogue");
    expect(useGame.getState().activeDialogue).toBeNull();
  });

  it("resolves route objectives and grants rewards only once", () => {
    useGame.getState().initChapter(12);
    dismissPreBattleDialogue();
    removeAllEnemies();

    const startingGold = useGame.getState().gold;
    triggerBattleEndCheck();

    expect(useGame.getState().phase).toBe("victory");
    expect(useGame.getState().activeDialogue).toBe("ch13_victory");
    expect(useGame.getState().gold).toBe(startingGold + 1800);

    const rewardedGold = useGame.getState().gold;
    useGame.setState({ phase: "player" });
    triggerBattleEndCheck();
    expect(useGame.getState().gold).toBe(rewardedGold);
  });

  it("resolves defend objectives on the required turn", () => {
    useGame.getState().initChapter(3);
    dismissPreBattleDialogue();
    const chapter = useGame.getState().chapter;
    if (!chapter?.objectiveTurns) throw new Error("Expected a defend objective");
    useGame.setState({ turn: chapter.objectiveTurns });

    triggerBattleEndCheck();

    expect(useGame.getState().phase).toBe("victory");
    expect(useGame.getState().activeDialogue).toBe("ch04_victory");
  });

  it("resolves seize objectives when a player reaches the target", () => {
    useGame.getState().initChapter(10);
    dismissPreBattleDialogue();
    const state = useGame.getState();
    const seizeTile = state.chapter?.seizeTile;
    const unit = state.units.find(candidate => candidate.faction === "player" && !candidate.isDead);
    if (!state.grid || !seizeTile || !unit) throw new Error("Invalid seize chapter setup");
    state.grid.moveUnit(unit, seizeTile);
    useGame.setState({ units: [...state.units] });

    triggerBattleEndCheck();

    expect(useGame.getState().phase).toBe("victory");
    expect(useGame.getState().activeDialogue).toBe("ch11_victory");
  });

  it("prioritizes defeat when the dead lord has been removed from runtime units", () => {
    useGame.getState().initChapter(12);
    dismissPreBattleDialogue();
    removeAllEnemies();
    const state = useGame.getState();
    const lord = state.units.find(unit => unit.def.isLord);
    if (!state.grid || !lord) throw new Error("Expected a living lord");
    lord.hp = 0;
    lord.isDead = true;
    state.grid.removeUnit(lord);
    useGame.setState({ units: [...state.grid.getAllUnits()] });

    triggerBattleEndCheck();

    expect(useGame.getState().phase).toBe("defeat");
    expect(useGame.getState().activeDialogue).toBeNull();
  });
});

describe("campaign progression", () => {
  it("preserves level, EXP, promotion, weapons, and stable UID in the next chapter", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    const uid = kael.uid;
    kael.level = 12;
    kael.exp = 47;
    kael.stats.str = 19;
    kael.hp = 1;
    kael.maxHp = 34;
    useGame.getState().useItemAction("master_seal", kael.uid);
    expect(kael.classDef).toBe(CLASSES.lord_knight);
    expect(useGame.getState().convoy.some(item => item.id === "master_seal")).toBe(false);
    const promotedStrength = kael.stats.str;
    const promotedMaxHp = kael.maxHp;
    kael.weapons.push({ ...WEAPONS.killing_edge, uses: 13 });
    kael.equippedWeapon = kael.weapons[kael.weapons.length - 1];
    useGame.setState({ units: [...useGame.getState().units], phase: "victory" });

    useGame.getState().startNextChapter();

    const nextKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().chapter?.id).toBe("ch02");
    expect(nextKael?.uid).toBe(uid);
    expect(nextKael?.level).toBe(12);
    expect(nextKael?.exp).toBe(47);
    expect(nextKael?.stats.str).toBe(promotedStrength);
    expect(nextKael?.classDef.id).toBe("lord_knight");
    expect(nextKael?.hp).toBe(promotedMaxHp);
    expect(nextKael?.maxHp).toBe(promotedMaxHp);
    expect(nextKael?.weapons.some(weapon => weapon.id === "killing_edge" && weapon.uses === 13)).toBe(true);
    expect(nextKael?.equippedWeapon?.id).toBe("killing_edge");
  });

  it("adds recruits at their authored chapter", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    useGame.setState({ phase: "victory" });
    useGame.getState().startNextChapter();
    useGame.setState({ activeDialogue: null, phase: "victory" });

    useGame.getState().startNextChapter();

    expect(useGame.getState().chapter?.id).toBe("ch03");
    expect(useGame.getState().units.some(unit => unit.def.id === "maren")).toBe(true);
    expect(useGame.getState().campaignRoster.maren).toBeDefined();
  });

  it("does not redeploy a player unit marked dead", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    const serra = useGame.getState().units.find(unit => unit.def.id === "serra");
    if (!serra) throw new Error("Serra was not deployed");
    serra.hp = 0;
    serra.isDead = true;
    useGame.setState({ units: [...useGame.getState().units], phase: "victory" });

    useGame.getState().startNextChapter();

    expect(useGame.getState().chapter?.id).toBe("ch02");
    expect(useGame.getState().units.some(unit => unit.def.id === "serra")).toBe(false);
    expect(useGame.getState().campaignRoster.serra?.isDead).toBe(true);
  });

  it("keeps fresh chapter initialization isolated from campaign progression", () => {
    useGame.getState().startNewCampaign();
    const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    kael.level = 15;
    useGame.setState({ units: [...useGame.getState().units] });

    useGame.getState().initChapter(1);

    const freshKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().chapter?.id).toBe("ch02");
    expect(freshKael?.level).toBe(1);
  });
});

describe("campaign save persistence", () => {
  it("creates a new-campaign autosave before any player action", () => {
    useGame.getState().startNewCampaign();
    const initialKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!initialKael) throw new Error("Kael was not deployed");
    const initialHp = initialKael.hp;

    initialKael.hp = 1;
    initialKael.hasActed = true;
    useGame.setState({ gold: 777, units: [...useGame.getState().units] });

    expect(useGame.getState().loadAutosave()).toBe(true);

    const restoredKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().chapter?.id).toBe("ch01");
    expect(useGame.getState().turn).toBe(1);
    expect(useGame.getState().gold).toBe(0);
    expect(restoredKael?.hp).toBe(initialHp);
    expect(restoredKael?.hasActed).toBe(false);
  });

  it("does not overwrite the retry checkpoint when ending the player turn", () => {
    vi.useFakeTimers();
    try {
      useGame.getState().startNewCampaign();
      const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
      if (!kael) throw new Error("Kael was not deployed");
      const initialHp = kael.hp;
      kael.hp = 1;
      kael.hasActed = true;
      useGame.setState({ units: [...useGame.getState().units] });

      useGame.getState().endPlayerTurn();
      expect(useGame.getState().phase).toBe("enemy");
      expect(useGame.getState().loadAutosave()).toBe(true);

      const restoredKael = useGame.getState().units.find(unit => unit.def.id === "kael");
      expect(useGame.getState().phase).toBe("player");
      expect(restoredKael?.hp).toBe(initialHp);
      expect(restoredKael?.hasActed).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("refreshes autosave at the beginning of the next player turn", async () => {
    useGame.getState().initChapter(3);
    dismissPreBattleDialogue();
    const state = useGame.getState();
    if (!state.grid) throw new Error("Chapter grid is not initialized");
    for (const unit of state.units) {
      if (unit.faction === "enemy") state.grid.removeUnit(unit);
    }
    const kael = state.grid.getAllUnits().find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    kael.hp = Math.max(1, kael.hp - 5);
    kael.hasActed = true;
    useGame.setState({
      phase: "enemy",
      units: [...state.grid.getAllUnits()],
    });

    await useGame.getState().processEnemyTurn();
    expect(useGame.getState().phase).toBe("player");
    expect(useGame.getState().turn).toBe(2);
    expect(kael.hasActed).toBe(false);

    kael.hp = 1;
    kael.hasActed = true;
    useGame.setState({ units: [...useGame.getState().units] });
    expect(useGame.getState().loadAutosave()).toBe(true);

    const restoredKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().turn).toBe(2);
    expect(restoredKael?.hp).toBe(kael.maxHp - 5);
    expect(restoredKael?.hasActed).toBe(false);
  });

  it("creates a next-chapter retry checkpoint with preserved progression", () => {
    useGame.getState().startNewCampaign();
    const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    kael.exp = 42;
    useGame.setState({ units: [...useGame.getState().units], phase: "victory" });

    useGame.getState().startNextChapter();
    const chapterTwoKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!chapterTwoKael) throw new Error("Kael did not enter chapter 2");
    chapterTwoKael.hp = 1;
    chapterTwoKael.hasActed = true;
    useGame.setState({ units: [...useGame.getState().units] });

    expect(useGame.getState().loadAutosave()).toBe(true);

    const restoredKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().chapter?.id).toBe("ch02");
    expect(restoredKael?.exp).toBe(42);
    expect(restoredKael?.hp).toBe(restoredKael?.maxHp);
    expect(restoredKael?.hasActed).toBe(false);
  });

  it("round-trips gold, promotion, durability, convoy, and permadeath", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    const initial = useGame.getState();
    const kael = initial.units.find(unit => unit.def.id === "kael");
    const serra = initial.units.find(unit => unit.def.id === "serra");
    if (!initial.grid || !kael || !serra) throw new Error("Invalid campaign setup");

    const kaelUid = kael.uid;
    kael.level = 11;
    kael.exp = 63;
    kael.weapons[0].uses = 9;
    useGame.getState().useItemAction("master_seal", kael.uid);
    serra.hp = 0;
    serra.isDead = true;
    initial.grid.removeUnit(serra);
    useGame.setState({
      gold: 2345,
      convoy: [
        ...useGame.getState().convoy,
        { id: "steel_sword", type: "weapon", uses: 21 },
      ],
      units: [...initial.units],
    });

    expect(useGame.getState().saveToSlot("slot0")).toBe(true);
    useGame.getState().returnToTitle();
    expect(useGame.getState().loadFromSlot("slot0")).toBe(true);

    const restored = useGame.getState();
    const restoredKael = restored.units.find(unit => unit.def.id === "kael");
    expect(restored.gold).toBe(2345);
    expect(restoredKael?.uid).toBe(kaelUid);
    expect(restoredKael?.level).toBe(11);
    expect(restoredKael?.exp).toBe(63);
    expect(restoredKael?.classDef.id).toBe("lord_knight");
    expect(restoredKael?.weapons[0].uses).toBe(9);
    expect(restored.convoy).toContainEqual({
      id: "steel_sword",
      type: "weapon",
      uses: 21,
    });
    expect(restored.units.find(unit => unit.def.id === "serra")?.isDead).toBe(true);
    expect(restored.campaignRoster.serra?.isDead).toBe(true);
    expect(restored.grid?.getAllUnits().some(unit => unit.def.id === "serra")).toBe(false);
  });

  it("round-trips campaign state through autosave", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    kael.exp = 88;
    kael.weapons[0].uses = 6;
    useGame.setState({ gold: 777, units: [...useGame.getState().units] });

    expect(useGame.getState().autosave()).toBe(true);
    useGame.getState().returnToTitle();
    expect(useGame.getState().loadAutosave()).toBe(true);

    const restoredKael = useGame.getState().units.find(unit => unit.def.id === "kael");
    expect(useGame.getState().gold).toBe(777);
    expect(restoredKael?.exp).toBe(88);
    expect(restoredKael?.weapons[0].uses).toBe(6);
  });
});

describe("shop economy", () => {
  it("buys a full-durability weapon and deducts the exact price", () => {
    useGame.getState().startNewCampaign();
    const before = useGame.getState().convoy.filter(item => item.id === "steel_sword").length;
    useGame.setState({ gold: 500 });

    expect(useGame.getState().buyItem("steel_sword")).toBe(true);

    const state = useGame.getState();
    expect(state.gold).toBe(0);
    expect(state.convoy.filter(item => item.id === "steel_sword")).toHaveLength(before + 1);
    expect(state.convoy.find(item => item.id === "steel_sword")?.uses).toBe(WEAPONS.steel_sword.uses);
  });

  it("rejects an unaffordable purchase without changing gold or convoy", () => {
    useGame.getState().startNewCampaign();
    useGame.setState({ gold: 499 });
    const before = [...useGame.getState().convoy];

    expect(useGame.getState().buyItem("steel_sword")).toBe(false);
    expect(useGame.getState().gold).toBe(499);
    expect(useGame.getState().convoy).toEqual(before);
  });

  it("lets a compatible unit take and equip a purchased convoy weapon", () => {
    useGame.getState().startNewCampaign();
    const kael = useGame.getState().units.find(unit => unit.def.id === "kael");
    if (!kael) throw new Error("Kael was not deployed");
    useGame.setState({ gold: 500, selectedUnit: kael });
    expect(useGame.getState().buyItem("steel_sword")).toBe(true);
    const convoyIndex = useGame.getState().convoy.findIndex(item => item.id === "steel_sword");

    useGame.getState().equipConvoyWeaponAction(convoyIndex);

    expect(kael.equippedWeapon?.id).toBe("steel_sword");
    expect(kael.equippedWeapon?.uses).toBe(WEAPONS.steel_sword.uses);
    expect(kael.equippedWeapon).not.toBe(WEAPONS.steel_sword);
    expect(useGame.getState().convoy.some(item => item.id === "steel_sword")).toBe(false);
  });
});

describe("durability integration", () => {
  it("consumes and removes a staff used through the store heal action", () => {
    useGame.getState().startNewCampaign();
    dismissPreBattleDialogue();
    const state = useGame.getState();
    const lyra = state.units.find(unit => unit.def.id === "lyra");
    const kael = state.units.find(unit => unit.def.id === "kael");
    if (!lyra?.equippedWeapon || !kael) throw new Error("Invalid healing setup");
    lyra.equippedWeapon.uses = 1;
    kael.hp -= 5;
    useGame.setState({
      selectedUnit: lyra,
      pendingMove: { ...lyra.pos },
      selectionMode: "actionMenu",
    });

    useGame.getState().healTarget(kael);

    expect(kael.hp).toBe(kael.maxHp);
    expect(lyra.weapons).toHaveLength(0);
    expect(lyra.equippedWeapon).toBeNull();
    const combatLog = useGame.getState().combatLog;
    expect(combatLog[combatLog.length - 1]?.text).toContain("broke");
  });
});
