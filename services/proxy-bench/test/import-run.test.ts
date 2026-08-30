import { describe, expect, test } from "bun:test";
import { importRun, validateResults, validateMetadata } from "../src/import-run";
import type { RawResults, RunMetadata } from "../src/import-run";

function sampleResults(): RawResults {
  return {
    generatedAt: "2026-08-30T00:00:00Z",
    smoke: false,
    sessionCount: 3,
    resultCount: 3,
    failureCount: 0,
    results: [
      {
        label: "varnish/plaintext/hit-path-rps",
        engine: "varnish",
        topology: "plaintext",
        workload: "hit-path-rps",
        samplesMs: [0.5, 0.6, 0.55, 0.52, 0.58],
        p50Ms: 0.55,
        p99Ms: 0.6,
        achievedRps: 5000,
        errorRate: 0,
        engineStats: { rssMb: 100 },
        metrics: { p50_ttfb: { value: 0.55, unit: "ms" } },
      },
      {
        label: "vinyl/plaintext/hit-path-rps",
        engine: "vinyl",
        topology: "plaintext",
        workload: "hit-path-rps",
        samplesMs: [0.6, 0.7, 0.65, 0.62, 0.68],
        p50Ms: 0.65,
        p99Ms: 0.7,
        achievedRps: 5000,
        errorRate: 0,
        engineStats: { rssMb: 110 },
        metrics: { p50_ttfb: { value: 0.65, unit: "ms" } },
      },
      {
        label: "nginx/plaintext/hit-path-rps",
        engine: "nginx",
        topology: "plaintext",
        workload: "hit-path-rps",
        samplesMs: [0.7, 0.8, 0.75, 0.72, 0.78],
        p50Ms: 0.75,
        p99Ms: 0.8,
        achievedRps: 5000,
        errorRate: 0,
        engineStats: { rssMb: 6 },
        metrics: { p50_ttfb: { value: 0.75, unit: "ms" } },
      },
    ],
    failures: [],
  };
}

function sampleMeta(): RunMetadata {
  return {
    runId: "bench-20260830-120000-42",
    engineType: "c7g.metal",
    clientType: "c7g.xlarge",
    originType: "c7g.xlarge",
    ami: "ami-0123456789abcdef0",
    region: "us-east-1",
    matrix: "smoke",
    gitSha: "abc123",
    timestamp: "2026-08-30T12:00:00Z",
  };
}

describe("importRun", () => {
  test("converts results and metadata to a BenchmarkRun", () => {
    const run = importRun(sampleResults(), sampleMeta());

    expect(run.id).toBe("bench-20260830-120000-42");
    expect(run.label).toContain("c7g.metal");
    expect(run.environment.machine).toContain("c7g.metal");
    expect(run.environment.chip).toContain("Graviton3");
    expect(run.environment.arch).toBe("arm64");
    expect(run.publishedAt).toBe("2026-08-30");
  });

  test("builds sections from results grouped by workload", () => {
    const run = importRun(sampleResults(), sampleMeta());

    expect(run.sections).toBeDefined();
    expect(run.sections!.length).toBe(1);
    expect(run.sections![0]!.id).toBe("hit-path-rps");
    expect(run.sections![0]!.candidates.length).toBe(3);
  });

  test("picks the candidate with the lowest median as the section winner", () => {
    const run = importRun(sampleResults(), sampleMeta());
    const section = run.sections![0]!;

    expect(section.verdict.winnerId).toBe("varnish-plaintext");
    expect(section.verdict.headline).toContain("Varnish Cache");
  });

  test("computes correct statistics from samples", () => {
    const run = importRun(sampleResults(), sampleMeta());
    const varnish = run.sections![0]!.candidates.find((c) => c.id === "varnish-plaintext");

    expect(varnish).toBeDefined();
    expect(varnish!.statistics.minMs).toBe(0.5);
    expect(varnish!.statistics.maxMs).toBe(0.6);
    expect(varnish!.statistics.medianMs).toBe(0.55);
  });

  test("rejects empty results", () => {
    const empty: RawResults = { ...sampleResults(), results: [], resultCount: 0 };
    expect(() => importRun(empty, sampleMeta())).toThrow("No results");
  });

  test("rejects missing runId", () => {
    const badMeta: RunMetadata = { ...sampleMeta(), runId: "" };
    expect(() => importRun(sampleResults(), badMeta)).toThrow("Missing runId");
  });
});

describe("validateResults", () => {
  test("accepts valid results", () => {
    const raw = sampleResults();
    expect(() => validateResults(raw)).not.toThrow();
  });

  test("rejects missing resultCount", () => {
    expect(() => validateResults({ results: [] })).toThrow("Invalid results format");
  });

  test("rejects results with invalid entries", () => {
    expect(() => validateResults({
      resultCount: 1,
      results: [{ notALabel: true }],
    })).toThrow("Invalid result entry");
  });
});

describe("validateMetadata", () => {
  test("accepts valid metadata", () => {
    expect(() => validateMetadata(sampleMeta())).not.toThrow();
  });

  test("rejects missing runId", () => {
    expect(() => validateMetadata({ engineType: "c7g.metal" })).toThrow("missing runId");
  });
});
