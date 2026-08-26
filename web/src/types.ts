export interface BenchmarkCatalog {
  schemaVersion: number;
  generatedAt: string;
  benchmarks: Benchmark[];
  queue: QueueItem[];
}

export interface Benchmark {
  id: string;
  slug: string;
  category: string;
  title: string;
  deck: string;
  publishedAt: string;
  unit: "ms";
  lowerIsBetter: boolean;
  verdict: {
    winnerId: string;
    headline: string;
    summary: string;
  };
  corpus: {
    name: string;
    source: string;
    files: number;
    lines: number;
    bytes: number;
  };
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
  ruleMap: RuleMapping[];
  candidates: Candidate[];
  limitations: string[];
}

export interface RuleMapping {
  intent: string;
  eslint: string;
  biome: string;
}

export interface Candidate {
  id: string;
  name: string;
  version: string;
  statistics: Statistics;
  samplesMs: number[];
}

export interface Statistics {
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export type StatisticKey = keyof Statistics;

export interface QueueItem {
  category: string;
  title: string;
  question: string;
  status: "Planned" | "Running" | "Published";
}
