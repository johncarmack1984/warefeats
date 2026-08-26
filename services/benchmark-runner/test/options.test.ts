import { describe, expect, test } from "bun:test";
import { parseOptions } from "../src/options";

describe("runner options", () => {
  test("uses publication defaults", () => {
    expect(parseOptions([])).toEqual({ runs: 20, warmups: 3 });
  });

  test("supports a CI smoke mode", () => {
    expect(parseOptions(["--quick"])).toEqual({ runs: 3, warmups: 1 });
  });

  test("accepts explicit counts and output", () => {
    expect(parseOptions(["--runs=8", "--warmups=2", "--output=result.json"])).toEqual({ runs: 8, warmups: 2, output: "result.json" });
  });

  test("rejects unknown options", () => {
    expect(() => parseOptions(["--fast"])).toThrow("Unknown option");
  });
});
