import { describe, expect, test } from "bun:test";
import { assembleCatalog } from "../scripts/assemble";
import { validateRef, validateRunPath } from "../scripts/sync";
import { parseCatalog } from "../src/catalog";
import { headTags, normalizePath, prerenderPaths, routeMeta } from "../src/head";
import { axisTicks, benchmarkTests, fiveNumber, reportText, samplePosition, standardDeviation, summarize } from "../src/metrics";
import type { BenchmarkCatalog } from "../src/types";

let _catalog: BenchmarkCatalog | undefined;
async function loadCatalog() {
  if (!_catalog) _catalog = await assembleCatalog();
  return _catalog;
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

describe("catalog assembly", () => {
  test("assembles the full catalog from registry + cache", async () => {
    const catalog = await assembleCatalog();

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.generatedAt).toBeTruthy();
    expect(catalog.benchmarks).toHaveLength(2);
    expect(catalog.queue.length).toBeGreaterThanOrEqual(1);
  });

  test("sets runnerUrl from the registry repo", async () => {
    const catalog = await assembleCatalog();

    expect(catalog.benchmarks[0]!.runnerUrl).toBe("https://github.com/warefeats/js-linter-tools");
    expect(catalog.benchmarks[1]!.runnerUrl).toBe("https://github.com/warefeats/http-caching-proxies");
  });

  test("merges the primary run into the legacy shape", async () => {
    const catalog = await assembleCatalog();
    const lint = catalog.benchmarks[0]!;

    expect(lint.id).toBe("lint-js-eslint-biome-2026-08");
    expect(lint.environment.chip).toBe("Apple M2 Max");
    expect(lint.protocol.runs).toBe(20);
    expect(lint.candidates.length).toBe(2);
  });

  test("preserves sections on a sections-based benchmark", async () => {
    const catalog = await assembleCatalog();
    const proxy = catalog.benchmarks[1]!;

    expect(proxy.sections).toBeDefined();
    expect(proxy.sections!.length).toBe(4);
    expect(proxy.candidates).toEqual([]);
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

  test("rejects a candidate with replicated samples when protocol.runs > 1", () => {
    expect(() => parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "replicated",
        slug: "replicated",
        category: "Test",
        title: "Replicated",
        deck: "Test",
        publishedAt: "2026-08-29",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A", summary: "A" },
        environment: { machine: "T", chip: "T", cores: "1", memory: "1 GB", os: "T", arch: "arm64", runtime: "T" },
        protocol: { warmups: 3, runs: 20, processModel: "container", cacheState: "warm", output: "TTFB" },
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 5, meanMs: 5, minMs: 5, maxMs: 5 }, samplesMs: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 6, meanMs: 6, minMs: 6, maxMs: 6 }, samplesMs: [6, 6, 6, 6, 6] },
        ],
        limitations: [],
      }],
    })).toThrow("samples look replicated");
  });

  test("rejects a section candidate with replicated samples when protocol.runs > 1", () => {
    expect(() => parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "replicated-section",
        slug: "replicated-section",
        category: "Test",
        title: "Replicated Section",
        deck: "Test",
        publishedAt: "2026-08-29",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A", summary: "A" },
        environment: { machine: "T", chip: "T", cores: "1", memory: "1 GB", os: "T", arch: "arm64", runtime: "T" },
        protocol: { warmups: 3, runs: 20, processModel: "container", cacheState: "warm", output: "TTFB" },
        candidates: [],
        sections: [{
          id: "s1",
          title: "S1",
          deck: "S1",
          unit: "ms",
          lowerIsBetter: true,
          verdict: { winnerId: "a", headline: "A", summary: "A" },
          candidates: [
            { id: "a", name: "A", version: "1.0", statistics: { medianMs: 3, meanMs: 3, minMs: 3, maxMs: 3 }, samplesMs: [3, 3, 3, 3, 3] },
            { id: "b", name: "B", version: "1.0", statistics: { medianMs: 4, meanMs: 4, minMs: 4, maxMs: 4 }, samplesMs: [4] },
          ],
        }],
        limitations: [],
      }],
    })).toThrow("samples look replicated");
  });

  test("accepts replicated samples when protocol.runs is 1", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-29T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "single-run",
        slug: "single-run",
        category: "Test",
        title: "Single",
        deck: "Test",
        publishedAt: "2026-08-29",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A", summary: "A" },
        environment: { machine: "T", chip: "T", cores: "1", memory: "1 GB", os: "T", arch: "arm64", runtime: "T" },
        protocol: { warmups: 0, runs: 1, processModel: "single", cacheState: "cold", output: "TTFB" },
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 5, meanMs: 5, minMs: 5, maxMs: 5 }, samplesMs: [5] },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 6, meanMs: 6, minMs: 6, maxMs: 6 }, samplesMs: [6] },
        ],
        limitations: [],
      }],
    });
    expect(catalog.benchmarks[0]!.id).toBe("single-run");
  });

  test("accepts benchmarks with optional runs for multiple environments", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-30T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "multi-env",
        slug: "multi-env",
        category: "Test",
        title: "Multi-env test",
        deck: "A benchmark with two environment runs",
        publishedAt: "2026-08-30",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A wins", summary: "A is faster" },
        environment: { machine: "MacBook Pro", chip: "Apple M2 Max", cores: "12", memory: "96 GB", os: "macOS", arch: "arm64", runtime: "Bun" },
        protocol: { warmups: 3, runs: 10, processModel: "container", cacheState: "warm", output: "TTFB" },
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
        runs: [
          {
            id: "cloud",
            label: "Cloud (c7g.xlarge)",
            environment: { machine: "EC2 c7g.xlarge", chip: "Graviton3", cores: "4 vCPU", memory: "8 GB", os: "Amazon Linux 2023", arch: "arm64", runtime: "Docker" },
            protocol: { warmups: 3, runs: 10, processModel: "container", cacheState: "warm", output: "TTFB" },
            publishedAt: "2026-08-30",
          },
        ],
        limitations: ["Test only"],
      }],
    });
    expect(catalog.benchmarks[0]!.runs!.length).toBe(1);
    expect(catalog.benchmarks[0]!.runs![0]!.id).toBe("cloud");
    expect(catalog.benchmarks[0]!.runs![0]!.label).toBe("Cloud (c7g.xlarge)");
  });

  test("accepts benchmarks without runs (backwards compatible)", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-30T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "no-runs",
        slug: "no-runs",
        category: "Test",
        title: "No runs",
        deck: "Test",
        publishedAt: "2026-08-30",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A", summary: "A" },
        environment: { machine: "T", chip: "T", cores: "1", memory: "1 GB", os: "T", arch: "arm64", runtime: "T" },
        protocol: { warmups: 0, runs: 1, processModel: "single", cacheState: "cold", output: "TTFB" },
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1] },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 2, meanMs: 2, minMs: 2, maxMs: 2 }, samplesMs: [2] },
        ],
        limitations: [],
      }],
    });
    expect(catalog.benchmarks[0]!.runs).toBeUndefined();
  });

  test("rejects a run entry with missing id or label", () => {
    expect(() => parseCatalog({
      schemaVersion: 1,
      queue: [],
      benchmarks: [{
        id: "bad-run",
        title: "Bad",
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1] },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 2, meanMs: 2, minMs: 2, maxMs: 2 }, samplesMs: [2] },
        ],
        runs: [{ id: "x" }],
      }],
    })).toThrow("invalid run entry");
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

describe("sync validators", () => {
  test("accepts a valid 40-char hex SHA", () => {
    expect(() => validateRef("3de924adf5e656698963a4b797c7cfb044176a4b")).not.toThrow();
  });

  test("rejects a short ref", () => {
    expect(() => validateRef("3de924a")).toThrow("Invalid ref");
  });

  test("rejects an uppercase ref", () => {
    expect(() => validateRef("3DE924ADF5E656698963A4B797C7CFB044176A4B")).toThrow("Invalid ref");
  });

  test("rejects a ref with non-hex characters", () => {
    expect(() => validateRef("zde924adf5e656698963a4b797c7cfb044176a4b")).toThrow("Invalid ref");
  });

  test("accepts a valid run path", () => {
    expect(() => validateRunPath("runs/local-2026-08.json")).not.toThrow();
  });

  test("rejects a path-traversal run path", () => {
    expect(() => validateRunPath("runs/../secrets.json")).toThrow("Invalid run path");
  });

  test("rejects a run path outside the runs directory", () => {
    expect(() => validateRunPath("benchmark.json")).toThrow("Invalid run path");
  });

  test("rejects a run path with subdirectories", () => {
    expect(() => validateRunPath("runs/sub/file.json")).toThrow("Invalid run path");
  });
});

describe("sections-only run assembly", () => {
  test("assembles a benchmark whose alternate run has sections but no candidates", () => {
    const catalog = parseCatalog({
      schemaVersion: 1,
      generatedAt: "2026-08-30T00:00:00Z",
      queue: [],
      benchmarks: [{
        id: "sections-only-alt",
        slug: "sections-only-alt",
        category: "Test",
        title: "Sections-only alternate",
        deck: "Primary has candidates, alternate has sections only",
        publishedAt: "2026-08-30",
        unit: "ms",
        lowerIsBetter: true,
        verdict: { winnerId: "a", headline: "A wins", summary: "A is faster" },
        environment: { machine: "T", chip: "T", cores: "1", memory: "1 GB", os: "T", arch: "arm64", runtime: "T" },
        protocol: { warmups: 3, runs: 10, processModel: "container", cacheState: "warm", output: "TTFB" },
        candidates: [
          { id: "a", name: "A", version: "1.0", statistics: { medianMs: 1, meanMs: 1, minMs: 1, maxMs: 1 }, samplesMs: [1] },
          { id: "b", name: "B", version: "1.0", statistics: { medianMs: 2, meanMs: 2, minMs: 2, maxMs: 2 }, samplesMs: [2] },
        ],
        runs: [{
          id: "cloud",
          label: "Cloud",
          environment: { machine: "EC2", chip: "Graviton3", cores: "4", memory: "8 GB", os: "AL2023", arch: "arm64", runtime: "Docker" },
          protocol: { warmups: 3, runs: 10, processModel: "container", cacheState: "warm", output: "TTFB" },
          publishedAt: "2026-08-30",
          sections: [{
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
          }],
        }],
        limitations: [],
      }],
    });

    expect(catalog.benchmarks[0]!.runs).toHaveLength(1);
    expect(catalog.benchmarks[0]!.runs![0]!.sections).toHaveLength(1);
    expect(catalog.benchmarks[0]!.runs![0]!.candidates).toBeUndefined();
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
