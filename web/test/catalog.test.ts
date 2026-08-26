import { describe, expect, test } from "bun:test";
import { parseCatalog } from "../src/catalog";
import { samplePosition, speedup } from "../src/metrics";

describe("benchmark catalog", () => {
  test("loads the published catalog", async () => {
    const file = Bun.file(new URL("../public/data/benchmarks.json", import.meta.url));
    const catalog = parseCatalog(await file.json());

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.benchmarks).toHaveLength(1);
    expect(catalog.benchmarks[0]?.candidates).toHaveLength(2);
  });

  test("derives the published median speedup from candidate values", async () => {
    const file = Bun.file(new URL("../public/data/benchmarks.json", import.meta.url));
    const catalog = parseCatalog(await file.json());
    const benchmark = catalog.benchmarks[0];

    expect(benchmark).toBeDefined();
    expect(speedup(benchmark!)).toBe(1.4);
  });

  test("positions samples within their own observed range", () => {
    expect(samplePosition(10, [10, 15, 20])).toBe(0);
    expect(samplePosition(15, [10, 15, 20])).toBe(50);
    expect(samplePosition(20, [10, 15, 20])).toBe(100);
  });
});

describe("catalog validation", () => {
  test("rejects unsupported schemas", () => {
    expect(() => parseCatalog({ schemaVersion: 2, benchmarks: [], queue: [] })).toThrow("unsupported shape");
  });

  test("rejects comparisons with fewer than two candidates", () => {
    expect(() => parseCatalog({ schemaVersion: 1, queue: [], benchmarks: [{ id: "one", title: "One", candidates: [] }] })).toThrow("at least two candidates");
  });
});
