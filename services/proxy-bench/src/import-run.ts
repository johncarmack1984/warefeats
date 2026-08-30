interface Statistics {
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

interface Candidate {
  id: string;
  name: string;
  version: string;
  statistics: Statistics;
  samplesMs: number[];
  configuration?: {
    engine: string;
    topology: string;
    workload: string;
  };
  metrics?: Record<string, { value: number; unit: string; label?: string }>;
}

interface BenchmarkSection {
  id: string;
  title: string;
  deck: string;
  unit: string;
  lowerIsBetter: boolean;
  verdict: { winnerId: string; headline: string; summary: string };
  candidates: Candidate[];
}

export interface BenchmarkRun {
  id: string;
  label: string;
  environment: {
    machine: string;
    chip: string;
    cores: string;
    memory: string;
    os: string;
    arch: string;
    runtime: string;
  };
  protocol: {
    warmups: number;
    runs: number;
    processModel: string;
    cacheState: string;
    output: string;
  };
  publishedAt: string;
  sections?: BenchmarkSection[];
  candidates?: Candidate[];
}

export interface RunMetadata {
  runId: string;
  engineType: string;
  clientType: string;
  originType: string;
  ami: string;
  region: string;
  matrix: string;
  gitSha: string;
  timestamp: string;
}

export interface RawResult {
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

export interface RawResults {
  generatedAt: string;
  smoke: boolean;
  sessionCount: number;
  resultCount: number;
  failureCount: number;
  results: RawResult[];
  failures: Array<{ label: string; error: string }>;
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

function stats(samples: number[]): Statistics {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    medianMs: r(pct(samples, 0.5), 3),
    meanMs: r(mean, 3),
    minMs: r(sorted[0]!, 3),
    maxMs: r(sorted[sorted.length - 1]!, 3),
  };
}

const CHIP_MAP: Record<string, string> = {
  "c7g.metal": "Graviton3 (64 vCPU)",
  "c7g.4xlarge": "Graviton3 (16 vCPU)",
  "c7g.xlarge": "Graviton3 (4 vCPU)",
};

const MEMORY_MAP: Record<string, string> = {
  "c7g.metal": "128 GiB",
  "c7g.4xlarge": "32 GiB",
  "c7g.xlarge": "8 GiB",
};

export function importRun(raw: RawResults, meta: RunMetadata): BenchmarkRun {
  if (!raw.results.length) throw new Error("No results to import");
  if (!meta.runId) throw new Error("Missing runId in metadata");

  const sections = buildSections(raw.results);

  return {
    id: meta.runId,
    label: `${meta.engineType} cluster (${meta.region})`,
    environment: {
      machine: `EC2 cluster (${meta.engineType} + 2× ${meta.clientType})`,
      chip: CHIP_MAP[meta.engineType] ?? meta.engineType,
      cores: "64 vCPU engine, 4 vCPU client/origin",
      memory: MEMORY_MAP[meta.engineType] ?? "unknown",
      os: `Ubuntu 24.04 arm64 (${meta.ami})`,
      arch: "arm64",
      runtime: "Docker on bare metal",
    },
    protocol: {
      warmups: 3,
      runs: raw.results[0]!.samplesMs.length,
      processModel: "Three EC2 instances in a cluster placement group",
      cacheState: "Warm cache after three unmeasured passes",
      output: "TTFB via oha with latency correction",
    },
    publishedAt: meta.timestamp.split("T")[0]!,
    sections,
  };
}

function buildSections(results: RawResult[]): BenchmarkSection[] {
  const workloads = [...new Set(results.map((r) => r.workload))];
  const sections: BenchmarkSection[] = [];

  for (const workload of workloads) {
    const wResults = results.filter((r) => r.workload === workload && r.topology === "plaintext");
    if (wResults.length < 2) continue;

    const candidates: Candidate[] = wResults.map((r) => ({
      id: `${r.engine}-${r.topology}`,
      name: engineName(r.engine),
      version: "pinned",
      statistics: stats(r.samplesMs),
      samplesMs: r.samplesMs,
      configuration: {
        engine: r.engine,
        topology: r.topology,
        workload: r.workload,
      },
      metrics: r.metrics,
    }));

    const best = candidates.reduce((a, b) => a.statistics.medianMs < b.statistics.medianMs ? a : b);

    sections.push({
      id: workload,
      title: workloadTitle(workload),
      deck: workloadDeck(workload),
      unit: "ms",
      lowerIsBetter: true,
      verdict: {
        winnerId: best.id,
        headline: `${best.name} leads on ${workloadTitle(workload).toLowerCase()}`,
        summary: `${best.name} posted ${best.statistics.medianMs} ms median.`,
      },
      candidates,
    });
  }

  return sections;
}

function engineName(engine: string): string {
  switch (engine) {
    case "varnish": return "Varnish Cache";
    case "vinyl": return "Vinyl Cache";
    case "nginx": return "NGINX";
    default: return engine;
  }
}

function workloadTitle(w: string): string {
  switch (w) {
    case "hit-path-rps": return "Hit-path RPS";
    case "segment-serve": return "Segment serve";
    case "miss-storm": return "Miss-storm coalescing";
    case "origin-flap": return "Origin-flap grace";
    default: return w;
  }
}

function workloadDeck(w: string): string {
  switch (w) {
    case "hit-path-rps": return "Sustained 5000 rps against a 2 KB cached manifest.";
    case "segment-serve": return "4 MB segment GET and Range GET at 500 rps.";
    case "miss-storm": return "200-concurrent burst on a cold 4 MB segment, measuring request coalescing.";
    case "origin-flap": return "Origin returns 500s; does the proxy serve stale/grace content?";
    default: return "";
  }
}

export function validateResults(raw: unknown): RawResults {
  const data = raw as Record<string, unknown>;
  if (typeof data.resultCount !== "number" || !Array.isArray(data.results)) {
    throw new Error("Invalid results format: missing resultCount or results array");
  }
  for (const result of data.results) {
    const r = result as Record<string, unknown>;
    if (typeof r.label !== "string" || typeof r.engine !== "string" || !Array.isArray(r.samplesMs)) {
      throw new Error(`Invalid result entry: ${JSON.stringify(r).slice(0, 100)}`);
    }
  }
  return data as unknown as RawResults;
}

export function validateMetadata(raw: unknown): RunMetadata {
  const data = raw as Record<string, unknown>;
  if (typeof data.runId !== "string" || typeof data.engineType !== "string") {
    throw new Error("Invalid metadata: missing runId or engineType");
  }
  return data as unknown as RunMetadata;
}
