import { describe, expect, test } from "bun:test";
import { parseCatalog } from "../src/catalog";
import { headTags, normalizePath, prerenderPaths, routeMeta } from "../src/head";
import { axisTicks, benchmarkTests, fiveNumber, reportText, samplePosition, standardDeviation, summarize } from "../src/metrics";

async function loadCatalog() {
  const file = Bun.file(new URL("../public/data/benchmarks.json", import.meta.url));
  return parseCatalog(await file.json());
}

describe("benchmark catalog", () => {
  test("loads the published catalog", async () => {
    const catalog = await loadCatalog();

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.benchmarks.length).toBeGreaterThanOrEqual(1);
    expect(catalog.benchmarks[0]?.candidates.length).toBeGreaterThanOrEqual(2);
  });

  test("summarizes the winner against every other candidate with a propagated sigma", async () => {
    const catalog = await loadCatalog();
    const summary = summarize(catalog.benchmarks[0]!);

    expect(summary.winner.id).toBe("biome");
    expect(summary.comparisons).toHaveLength(1);
    expect(summary.comparisons[0]?.ratio).toBeCloseTo(106.0 / 75.4, 3);
    expect(summary.comparisons[0]?.sigma).toBeGreaterThan(0);
    expect(summary.comparisons[0]?.sigma).toBeLessThan(0.1);
  });

  test("renders the report in hyperfine's shape", async () => {
    const catalog = await loadCatalog();
    const text = reportText(catalog.benchmarks[0]!);

    expect(text).toContain("Benchmark 1: ESLint 9.34.0");
    expect(text).toContain("Time (mean ± σ)");
    expect(text).toContain("Biome 2.2.2 ran");
    expect(text).toMatch(/1\.4\d ± 0\.0\d times faster than ESLint 9\.34\.0/);
  });

  test("charts no bar tests unless the catalog declares them", async () => {
    const catalog = await loadCatalog();
    expect(benchmarkTests(catalog.benchmarks[0]!)).toEqual([]);
  });

  test("computes the five-number summary with interpolated quartiles", () => {
    expect(fiveNumber([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ min: 1, q1: 2.75, median: 4.5, q3: 6.25, max: 8 });
    expect(fiveNumber([5])).toEqual({ min: 5, q1: 5, median: 5, q3: 5, max: 5 });
  });

  test("positions samples within the shared range", () => {
    expect(samplePosition(10, 10, 20)).toBe(0);
    expect(samplePosition(15, 10, 20)).toBe(50);
    expect(samplePosition(20, 10, 20)).toBe(100);
  });

  test("computes a sample standard deviation", () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(standardDeviation([5])).toBe(0);
  });

  test("picks friendly axis ticks", () => {
    const ticks = axisTicks(71, 110, 6);
    expect(ticks[0]).toBeGreaterThanOrEqual(71);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(110);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("catalog validation", () => {
  test("rejects unsupported schemas", () => {
    expect(() => parseCatalog({ schemaVersion: 2, benchmarks: [], queue: [] })).toThrow("unsupported shape");
  });

  test("accepts benchmarks without corpus or ruleMap", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "proxy-bench-test",
        slug: "proxy-bench-test",
        category: "Caching proxies",
        title: "Test",
        deck: "Test benchmark",
        publishedAt: "2026-08-29",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A wins", summary: "A is faster" },
        environment: { machine: "Test", chip: "Test", cores: "1", memory: "1 GB", os: "Test", arch: "arm64", runtime: "Docker" },
        protocol: { warmups: 3, runs: 20, processModel: "container", cacheState: "warm", output: "TTFB" },
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1], configuration: { engine: "varnish", topology: "plaintext", workload: "hit-path-rps", targetRps: 5000 }, metrics: { p50: { value: 1, unit: "ms" } } },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 2, meanMs: 2, minMs: 2, maxMs: 2 }, samplesMs: [2] },
        ],
        limitations: ["Test only"],
      }],
    });
    expect(catalog.benchmarks[0]!.id).toBe("proxy-bench-test");
  });

  test("rejects comparisons with fewer than two candidates", () => {
    expect(() => parseCatalog({ schemaVersion: 1, queue: [], benchmarks: [{ id: "one", title: "One", candidates: [] }] })).toThrow("at least two candidates");
  });

  test("accepts benchmarks with sections instead of top-level candidates", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "test-sections",
        slug: "test-sections",
        category: "Test",
        title: "Sections test",
        deck: "A test",
        publishedAt: "2026-08-29",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "mixed", headline: "Mixed", summary: "No single winner" },
        environment: { machine: "Test", chip: "Test", cores: "1", memory: "1 GB", os: "Test", arch: "arm64", runtime: "Docker" },
        protocol: { warmups: 3, runs: 20, processModel: "container", cacheState: "warm", output: "TTFB" },
        candidates: [],
        sections: [
          {
            id: "s1",
            title: "Section 1",
            deck: "First section",
            unit: "ms",
            lowerIsBetter: true,
            verdict: { winnerId: "a", headline: "A wins", summary: "A faster" },
            candidates: [
              { id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1] },
              { id: "b", name: "B", version: "1.0", statistics: { medianMs: 2, meanMs: 2, minMs: 2, maxMs: 2 }, samplesMs: [2] },
            ],
          },
        ],
        limitations: ["Test only"],
      }],
    });
    expect(catalog.benchmarks[0]!.sections!.length).toBe(1);
  });

  test("rejects sections with fewer than two candidates", () => {
    expect(() => parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "bad-section",
        title: "Bad",
        candidates: [],
        sections: [{ id: "s1", candidates: [{ id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1] }] }],
      }],
    })).toThrow("at least two candidates");
  });

  test("loads the published sections benchmark with four sections", async () => {
    const catalog = await loadCatalog();
    const proxy = catalog.benchmarks.find((b) => b.sections?.length);
    expect(proxy).toBeDefined();
    expect(proxy!.sections!.length).toBe(4);
    for (const section of proxy!.sections!) {
      expect(section.candidates.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("routes", () => {
  test("normalizes paths to a trailing slash", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/about")).toBe("/about/");
    expect(normalizePath("/about/?x=1")).toBe("/about/");
  });

  test("prerenders one page per benchmark plus the fixed pages", async () => {
    const catalog = await loadCatalog();
    const paths = prerenderPaths(catalog);
    expect(paths).toContain("/");
    expect(paths).toContain("/methodology/");
    expect(paths).toContain("/about/");
    expect(paths).toContain("/benchmarks/eslint-vs-biome-javascript-lint/");
    expect(paths).toContain("/benchmarks/http-caching-proxies-hls/");
  });

  test("builds benchmark metadata from the catalog", async () => {
    const catalog = await loadCatalog();
    const meta = routeMeta("/benchmarks/eslint-vs-biome-javascript-lint", catalog);

    expect(meta.status).toBe(200);
    expect(meta.title).toBe("ESLint vs Biome | warefeats");
    expect(meta.description).toContain("Biome 2.2.2 ran");
    expect(headTags(meta)).toContain('<link rel="canonical" href="https://warefeats.com/benchmarks/eslint-vs-biome-javascript-lint/" />');
    expect(meta.image).toBe("https://warefeats.com/og/eslint-vs-biome-javascript-lint.png");
    expect(headTags(meta)).toContain('<meta property="og:image" content="https://warefeats.com/og/eslint-vs-biome-javascript-lint.png" />');
  });

  test("marks unknown routes as not found", async () => {
    const catalog = await loadCatalog();
    const meta = routeMeta("/benchmarks/nope", catalog);

    expect(meta.status).toBe(404);
    expect(headTags(meta)).toContain('name="robots" content="noindex"');
  });
});

describe("open graph cards", () => {
  test("renders the benchmark card with the ratio", async () => {
    const { benchmarkCard } = await import("../src/og");
    const font = async (name: string) => {
      const bytes = await Bun.file(new URL(`../assets/fonts/${name}`, import.meta.url)).arrayBuffer();
      return bytes;
    };
    const fonts = { mono500: await font("MartianMono-500.ttf"), mono700: await font("MartianMono-700.ttf"), sans500: await font("RedHatText-500.ttf") };
    const catalog = await loadCatalog();
    const svg = await benchmarkCard(catalog.benchmarks[0]!, fonts);

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });
});
