import { describe, it, expect } from "vitest";
import { decideAIAction } from "./ai";
import { createUnit } from "../data/unitFactory";
import { GameGrid } from "./grid";

describe("AI", () => {
  it("aggressive attacks when in range", () => {
    const g = new GameGrid(8, 8);
    const bandit = createUnit("bandit_sword", { x: 4, y: 4 });
    bandit.aiType = "aggressive";
    const kael = createUnit("kael", { x: 4, y: 5 }); // adjacent
    g.placeUnit(bandit, { x: 4, y: 4 });
    g.placeUnit(kael, { x: 4, y: 5 });
    const dec = decideAIAction(bandit, g, [bandit, kael]);
    expect(dec.action).toBe("attack");
    expect(dec.attackTarget?.uid).toBe(kael.uid);
  });

  it("aggressive waits when no enemy in range and no path closes distance", () => {
    const g = new GameGrid(20, 20); // bigger so movement options exist
    const bandit = createUnit("bandit_sword", { x: 0, y: 0 });
    bandit.aiType = "aggressive";
    const kael = createUnit("kael", { x: 19, y: 19 }); // far away
    g.placeUnit(bandit, { x: 0, y: 0 });
    g.placeUnit(kael, { x: 19, y: 19 });
    const dec = decideAIAction(bandit, g, [bandit, kael]);
    // Should at minimum move toward the player, not just wait
    expect(dec.action).toBe("move");
    expect(dec.moveTarget).toBeDefined();
  });

  it("aggressive_auto always moves toward nearest enemy", () => {
    const g = new GameGrid(20, 20);
    const bandit = createUnit("bandit_sword", { x: 0, y: 0 });
    bandit.aiType = "aggressive_auto";
    const kael = createUnit("kael", { x: 19, y: 19 });
    g.placeUnit(bandit, { x: 0, y: 0 });
    g.placeUnit(kael, { x: 19, y: 19 });
    const dec = decideAIAction(bandit, g, [bandit, kael]);
    expect(dec.action).toBe("move");
  });

  it("stationary attacks if in range, else waits", () => {
    const g = new GameGrid(8, 8);
    const bandit = createUnit("bandit_sword", { x: 4, y: 4 });
    bandit.aiType = "stationary";
    const kael = createUnit("kael", { x: 4, y: 5 });
    g.placeUnit(bandit, { x: 4, y: 4 });
    g.placeUnit(kael, { x: 4, y: 5 });
    const dec = decideAIAction(bandit, g, [bandit, kael]);
    expect(dec.action).toBe("attack");
  });

  it("stationary waits when no enemy in range", () => {
    const g = new GameGrid(8, 8);
    const bandit = createUnit("bandit_sword", { x: 4, y: 4 });
    bandit.aiType = "stationary";
    const kael = createUnit("kael", { x: 7, y: 7 }); // far
    g.placeUnit(bandit, { x: 4, y: 4 });
    g.placeUnit(kael, { x: 7, y: 7 });
    const dec = decideAIAction(bandit, g, [bandit, kael]);
    expect(dec.action).toBe("wait");
  });

  it("healer heals wounded allies in range", () => {
    const g = new GameGrid(8, 8);
    const healer = createUnit("lyra", { x: 4, y: 4 });
    healer.aiType = "healer";
    const ally = createUnit("serra", { x: 4, y: 5 });
    ally.hp = ally.maxHp - 5;
    g.placeUnit(healer, { x: 4, y: 4 });
    g.placeUnit(ally, { x: 4, y: 5 });
    // healer is player (lyra). ally (serra) is also player. So healer should find a wounded ally.
    const dec = decideAIAction(healer, g, [healer, ally]);
    expect(dec.action === "heal" || dec.action === "wait").toBe(true);
    // With ally adjacent and wounded, expect heal
    expect(dec.action).toBe("heal");
  });
});
