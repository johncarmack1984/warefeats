import { describe, expect, test } from "bun:test";
import { relativeSpeedup, summarize } from "../src/stats";

describe("benchmark statistics", () => {
  test("summarizes even sample sets", () => {
    expect(summarize([4, 1, 3, 2])).toEqual({ medianMs: 2.5, meanMs: 2.5, minMs: 1, maxMs: 4 });
  });

  test("summarizes odd sample sets", () => {
    expect(summarize([8.04, 7.04, 9.04])).toEqual({ medianMs: 8, meanMs: 8, minMs: 7, maxMs: 9 });
  });

  test("calculates a rounded speedup", () => {
    expect(relativeSpeedup(835.8, 84)).toBe(9.9);
  });

  test("requires samples", () => {
    expect(() => summarize([])).toThrow("At least one sample");
  });
});
