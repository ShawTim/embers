import { describe, expect, it } from "vitest";
import { parseE2ETimingScale } from "./timing";

describe("E2E timing scale", () => {
  it("uses normal timing without an explicit query parameter", () => {
    expect(parseE2ETimingScale("")).toBe(1);
  });

  it("accepts a bounded explicit development speed", () => {
    expect(parseE2ETimingScale("?e2eSpeed=0.05")).toBe(0.05);
    expect(parseE2ETimingScale("?e2eSpeed=0")).toBe(0.01);
    expect(parseE2ETimingScale("?e2eSpeed=4")).toBe(1);
  });

  it("ignores invalid timing values", () => {
    expect(parseE2ETimingScale("?e2eSpeed=fast")).toBe(1);
  });
});
