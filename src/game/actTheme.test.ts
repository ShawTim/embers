import { describe, it, expect } from "vitest";
import { actForChapter, themeForAct, themeForChapter, allActs } from "./actTheme";

describe("per-act theme", () => {
  it("actForChapter maps every chapter to an act", () => {
    for (let i = 1; i <= 20; i++) {
      const id = `ch${String(i).padStart(2, "0")}`;
      const act = actForChapter(id);
      expect(["prologue", "act1", "act2", "act3", "act4"]).toContain(act);
    }
  });

  it("Prologue covers ch01-ch02", () => {
    expect(actForChapter("ch01")).toBe("prologue");
    expect(actForChapter("ch02")).toBe("prologue");
  });

  it("Act I covers ch03-ch05", () => {
    expect(actForChapter("ch03")).toBe("act1");
    expect(actForChapter("ch04")).toBe("act1");
    expect(actForChapter("ch05")).toBe("act1");
  });

  it("Act II covers ch06-ch10", () => {
    expect(actForChapter("ch06")).toBe("act2");
    expect(actForChapter("ch10")).toBe("act2");
  });

  it("Act III covers ch11-ch15", () => {
    expect(actForChapter("ch11")).toBe("act3");
    expect(actForChapter("ch15")).toBe("act3");
  });

  it("Act IV covers ch16-ch20", () => {
    expect(actForChapter("ch16")).toBe("act4");
    expect(actForChapter("ch20")).toBe("act4");
  });

  it("Unknown chapter falls back to prologue", () => {
    expect(actForChapter("ch99")).toBe("prologue");
    expect(actForChapter("")).toBe("prologue");
  });

  it("Each act has 5-color accent + label + numeral", () => {
    for (const t of allActs()) {
      expect(t.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.labelZh.length).toBeGreaterThan(0);
      expect(t.numeral.length).toBeGreaterThan(0);
    }
  });

  it("Per-act accent colors are distinct", () => {
    const accents = allActs().map(t => t.accent);
    const unique = new Set(accents);
    expect(unique.size).toBe(accents.length);
  });

  it("themeForChapter returns the same as themeForAct(actForChapter)", () => {
    for (let i = 1; i <= 20; i++) {
      const id = `ch${String(i).padStart(2, "0")}`;
      expect(themeForChapter(id)).toBe(themeForAct(actForChapter(id)));
    }
  });

  it("Acts are listed in chronological order (prologue → act4)", () => {
    const ids = allActs().map(a => a.id);
    expect(ids).toEqual(["prologue", "act1", "act2", "act3", "act4"]);
  });
});
