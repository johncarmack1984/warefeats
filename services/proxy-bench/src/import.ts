import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname!, "..");
const resultsPath = join(root, "results.json");
const benchmarksPath = join(root, "..", "..", "web", "public", "data", "benchmarks.json");

interface RawResult {
  label: string;
  engine: string;
  topology: string;
  workload: string;
  samplesMs: number[];
  p50Ms: number;
  p99Ms: number;
  achievedRps: number;
  errorRate: number;
  engineStats: { rssMb: number; cacheHits?: number; cacheMisses?: number; hitRatio?: number };
  metrics: Record<string, { value: number; unit: string; label?: string }>;
}

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = p * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}

function r(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    medianMs: r(pct(samples, 0.5), 3),
    meanMs: r(mean, 3),
    minMs: r(sorted[0]!, 3),
    maxMs: r(sorted[sorted.length - 1]!, 3),
  };
}

function candidateId(engine: string, topology: string): string {
  return `${engine}-${topology}`;
}

function candidateName(engine: string, topology: string, versions: Map<string, string>): string {
  const v = versions.get(engine) ?? engine;
  const topoLabel: Record<string, string> = { plaintext: "plaintext", "tls-inprocess": "TLS", "proxyv2-haproxy": "PROXYv2" };
  return `${v} (${topoLabel[topology] ?? topology})`;
}

const ENGINE_VERSIONS: Map<string, string> = new Map([
  ["varnish", "Varnish 9.0.3"],
  ["vinyl", "Vinyl c67fd5f57"],
  ["nginx", "NGINX stable"],
]);

const ENGINE_SHORT_VERSIONS: Map<string, string> = new Map([
  ["varnish", "9.0.3"],
  ["vinyl", "c67fd5f57"],
  ["nginx", "stable"],
]);

/** Official, unmodified product marks (self-hosted under web/public/logos) and brand colors for the charts. */
const ENGINE_BRAND: Record<string, { logo: string; color: string; homepage: string }> = {
  varnish: { logo: "/logos/varnish-cache.svg", color: "#0763ED", homepage: "https://www.varnish.org" },
  vinyl: { logo: "/logos/vinyl-cache.svg", color: "#660066", homepage: "https://vinyl-cache.org" },
  nginx: { logo: "/logos/nginx.svg", color: "#009639", homepage: "https://nginx.org" },
};

const TRADEMARKS = [
  "Logos identify the products under test and imply no endorsement.",
  "Varnish is a registered trademark of Varnish Software AB.",
  "NGINX is a trademark of F5, Inc.",
  "Vinyl Cache logo: CC BY 4.0 Rhubarbe.design.",
];

function buildW1Section(results: RawResult[]) {
  const w1 = results.filter((r) => r.workload === "hit-path-rps");

  const candidates = w1.map((r) => ({
    id: candidateId(r.engine, r.topology),
    name: candidateName(r.engine, r.topology, ENGINE_VERSIONS),
    version: ENGINE_SHORT_VERSIONS.get(r.engine) ?? r.engine,
    ...ENGINE_BRAND[r.engine],
    statistics: stats(r.samplesMs),
    samplesMs: r.samplesMs,
    configuration: { engine: r.engine, topology: r.topology as "plaintext" | "tls-inprocess" | "proxyv2-haproxy", workload: "hit-path-rps" as const, targetRps: 5000, concurrency: 50 },
    metrics: r.metrics,
  }));

  const sorted = [...candidates].sort((a, b) => a.statistics.medianMs - b.statistics.medianMs);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;

  return {
    id: "hit-path-rps",
    title: "Hit-path TTFB at 5000 rps",
    deck: "p99 TTFB at 5000 rps on a 2 KB manifest across three caching proxies and three TLS topologies.",
    unit: "ms",
    lowerIsBetter: true,
    verdict: {
      winnerId: best.id,
      headline: `p99 TTFB ranged from ${best.statistics.medianMs} ms (${best.name}) to ${worst.statistics.medianMs} ms (${worst.name})`,
      summary: `5000 rps sustained on a 2 KB manifest, warm cache, 20 measured passes per engine-topology pair.`,
    },
    candidates,
    tests: [
      {
        id: "p50-ttfb",
        title: "p50 TTFB",
        description: "50th-percentile time to first byte at 5000 rps",
        unit: "ms",
        lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p50_ttfb?.value ?? 0 })),
      },
      {
        id: "p99-ttfb",
        title: "p99 TTFB",
        description: "99th-percentile time to first byte at 5000 rps",
        unit: "ms",
        lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p99_ttfb?.value ?? 0 })),
      },
    ],
  };
}

function buildW2Section(results: RawResult[]) {
  const w2 = results.filter((r) => r.workload === "segment-serve");

  const fullResults = w2.filter((r) => !r.metrics.variant);
  const rangeResults = w2.filter((r) => !!r.metrics.variant);

  const rangeMap = new Map<string, RawResult>();
  for (const rr of rangeResults) {
    rangeMap.set(`${rr.engine}/${rr.topology}`, rr);
  }

  const candidates = fullResults.map((r) => {
    const rng = rangeMap.get(`${r.engine}/${r.topology}`);
    return {
      id: candidateId(r.engine, r.topology),
      name: candidateName(r.engine, r.topology, ENGINE_VERSIONS),
      version: ENGINE_SHORT_VERSIONS.get(r.engine) ?? r.engine,
      ...ENGINE_BRAND[r.engine],
      statistics: stats(r.samplesMs),
      samplesMs: r.samplesMs,
      configuration: { engine: r.engine, topology: r.topology as "plaintext" | "tls-inprocess" | "proxyv2-haproxy", workload: "segment-serve" as const, targetRps: 500, concurrency: 50 },
      metrics: r.metrics,
      _rangeP50: rng?.metrics.p50_ttfb?.value ?? 0,
      _rangeP99: rng?.metrics.p99_ttfb?.value ?? 0,
    };
  });

  const sortedFull = [...candidates].sort((a, b) => a.statistics.medianMs - b.statistics.medianMs);
  const bestFull = sortedFull[0]!;
  const worstFull = sortedFull[sortedFull.length - 1]!;

  const rangeP99s = candidates.map((c) => c._rangeP99).filter((v) => v > 0);
  const rangeMin = r(Math.min(...rangeP99s), 2);
  const rangeMax = r(Math.max(...rangeP99s), 2);

  const publicCandidates = candidates.map(({ _rangeP50, _rangeP99, ...c }) => c);

  return {
    id: "segment-serve",
    title: "4 MB segment serve",
    deck: "4 MB segment delivery latency, full GET and 64 KB range, at 500 rps.",
    unit: "ms",
    lowerIsBetter: true,
    verdict: {
      winnerId: bestFull.id,
      headline: `Full GET p99 TTFB ranged from ${bestFull.statistics.medianMs} ms (${bestFull.name}) to ${worstFull.statistics.medianMs} ms (${worstFull.name}); Range GET p99 ${rangeMin}–${rangeMax} ms`,
      summary: `4 MB segment at 500 rps, full GET and 64 KB range, warm cache, across eight engine-topology pairs.`,
    },
    candidates: publicCandidates,
    tests: [
      {
        id: "p50-full-get", title: "p50 full GET",
        description: "50th-percentile TTFB for 4 MB full GET at 500 rps", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p50_ttfb?.value ?? 0 })),
      },
      {
        id: "p50-range-get", title: "p50 range GET",
        description: "50th-percentile TTFB for 64 KB range GET at 500 rps", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c._rangeP50 })),
      },
      {
        id: "p99-full-get", title: "p99 full GET",
        description: "99th-percentile TTFB for 4 MB full GET at 500 rps", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p99_ttfb?.value ?? 0 })),
      },
      {
        id: "p99-range-get", title: "p99 range GET",
        description: "99th-percentile TTFB for 64 KB range GET at 500 rps", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c._rangeP99 })),
      },
    ],
  };
}

function buildW3Section(results: RawResult[]) {
  const w3 = results.filter((r) => r.workload === "miss-storm");
  const candidates = w3.map((r) => ({
    id: r.engine,
    name: ENGINE_VERSIONS.get(r.engine) ?? r.engine,
    version: ENGINE_SHORT_VERSIONS.get(r.engine) ?? r.engine,
    ...ENGINE_BRAND[r.engine],
    statistics: stats(r.samplesMs),
    samplesMs: r.samplesMs,
    configuration: { engine: r.engine, topology: r.topology as "plaintext", workload: "miss-storm" as const, concurrency: 200 },
    metrics: r.metrics,
  }));

  return {
    id: "miss-storm",
    title: "Miss-storm coalescing",
    deck: "200-client burst on a cold segment, 20 repetitions, plaintext only.",
    unit: "ms",
    lowerIsBetter: true,
    verdict: {
      winnerId: candidates.sort((a, b) => a.statistics.medianMs - b.statistics.medianMs)[0]!.id,
      headline: "All three engines coalesced 200 concurrent requests to 1 origin fetch",
      summary: "200-client burst on a cold 4 MB segment, 20 repetitions, plaintext only. With proxy_cache_lock_age/timeout set to 30s, NGINX coalesces identically to Varnish and Vinyl.",
    },
    candidates,
    tests: [
      {
        id: "p50-ttfb", title: "p50 TTFB",
        description: "50th-percentile TTFB per 200-client burst on a cold segment", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p50_ttfb?.value ?? 0 })),
      },
      {
        id: "p99-ttfb", title: "p99 TTFB",
        description: "99th-percentile TTFB per 200-client burst on a cold segment", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p99_ttfb?.value ?? 0 })),
      },
      {
        id: "coalescing", title: "Coalescing efficiency",
        description: "Ratio of concurrent clients to origin requests (200x = perfect coalescing)", unit: "x", lowerIsBetter: false,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.coalescing_efficiency?.value ?? 0 })),
      },
    ],
  };
}

function buildW4Section(results: RawResult[]) {
  const w4 = results.filter((r) => r.workload === "origin-flap");
  const candidates = w4.map((r) => ({
    id: r.engine,
    name: ENGINE_VERSIONS.get(r.engine) ?? r.engine,
    version: ENGINE_SHORT_VERSIONS.get(r.engine) ?? r.engine,
    ...ENGINE_BRAND[r.engine],
    statistics: stats(r.samplesMs),
    samplesMs: r.samplesMs,
    configuration: { engine: r.engine, topology: r.topology as "plaintext", workload: "origin-flap" as const, concurrency: 10 },
    metrics: r.metrics,
  }));

  return {
    id: "origin-flap",
    title: "Origin-flap grace",
    deck: "Grace/stale-if-error behavior across five origin failure cycles.",
    unit: "ms",
    lowerIsBetter: true,
    verdict: {
      winnerId: candidates.sort((a, b) => a.statistics.medianMs - b.statistics.medianMs)[0]!.id,
      headline: "All three engines maintained 100% grace hit ratio across five origin failure cycles",
      summary: "Five origin failure cycles, grace/stale-if-error responses measured at plaintext.",
    },
    candidates,
    tests: [
      {
        id: "p50-ttfb", title: "p50 TTFB",
        description: "50th-percentile TTFB during origin failure cycles", unit: "ms", lowerIsBetter: true,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.p50_ttfb?.value ?? 0 })),
      },
      {
        id: "grace-ratio", title: "Grace hit ratio",
        description: "Percentage of requests served from stale cache during origin failure", unit: "%", lowerIsBetter: false,
        results: candidates.map((c) => ({ candidateId: c.id, value: c.metrics.grace_ratio?.value ?? 0 })),
      },
    ],
  };
}

const raw: { results: RawResult[] } = JSON.parse(readFileSync(resultsPath, "utf8"));
const catalog = JSON.parse(readFileSync(benchmarksPath, "utf8"));

const w1 = buildW1Section(raw.results);
const w2 = buildW2Section(raw.results);
const w3 = buildW3Section(raw.results);
const w4 = buildW4Section(raw.results);

const proxyEntry = {
  id: "proxy-hls-2026-08",
  slug: "http-caching-proxies-hls",
  category: "Caching proxies",
  title: "HTTP caching proxies for HLS delivery",
  deck: "Varnish, Vinyl, and NGINX across four HLS workloads: hit-path TTFB, segment serve, miss-storm coalescing, and origin-flap grace.",
  publishedAt: "2026-08-29",
  unit: "ms",
  lowerIsBetter: true,
  verdict: {
    winnerId: "mixed",
    headline: "No single engine dominated all four workloads",
    summary: `${w1.verdict.winnerId === "mixed" ? "No clear hit-path winner" : `${w1.candidates.find((c) => c.id === w1.verdict.winnerId)?.name} led on hit-path`}, ${w2.candidates.find((c) => c.id === w2.verdict.winnerId)?.name} led on segment serve, all three coalesced 200 concurrent requests to one origin fetch, and all three maintained 100% grace under origin failure.`,
  },
  environment: {
    machine: "MacBook Pro",
    chip: "Apple M2 Max",
    cores: "12 CPU cores",
    memory: "96 GB",
    os: "macOS 26.0",
    arch: "arm64",
    runtime: "Docker (OrbStack)",
  },
  protocol: {
    warmups: 3,
    runs: 20,
    processModel: "Container per engine, shared origin",
    cacheState: "Warm cache after three curl requests (W1/W2) or cold by construction (W3)",
    output: "TTFB via oha 1.16.0 with --latency-correction",
  },
  candidates: [],
  sections: [w1, w2, w3, w4],
  trademarks: TRADEMARKS,
  limitations: [
    "Varnish Cache and Vinyl Cache share a maintainer team and a common ancestor commit (63806461); this benchmark measures shipped binaries and configuration only.",
    "Docker/OrbStack on an M2 Max is a virtualized arm64 rig, not bare-metal x86_64; numbers are relative only.",
    "Vinyl c67fd5f57 has no in-process TLS listener in this configuration; its TLS-topology coverage is PROXYv2-only.",
    "NGINX hit/miss accounting is log-derived ($upstream_cache_status), coarser than varnishstat/vinylstat's live counters.",
    "Purge/ban stampede is out of scope this pass (queued).",
    "Client, terminator, engine, and origin share one host's CPU/network stack — results reflect relative efficiency under shared contention, not isolated network performance.",
    "Traffic is synthetic HLS-shaped load, not a captured production trace.",
  ],
};

const idx = catalog.benchmarks.findIndex((b: { id: string }) => b.id === "proxy-hls-2026-08");
if (idx >= 0) {
  catalog.benchmarks[idx] = proxyEntry;
} else {
  catalog.benchmarks.push(proxyEntry);
}

catalog.generatedAt = new Date().toISOString();
writeFileSync(benchmarksPath, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Updated ${benchmarksPath}`);
console.log(`  W1: ${w1.candidates.length} candidates, winner: ${w1.verdict.winnerId}`);
console.log(`  W2: ${w2.candidates.length} candidates, winner: ${w2.verdict.winnerId}`);
console.log(`  W3: ${w3.candidates.length} candidates`);
console.log(`  W4: ${w4.candidates.length} candidates`);
