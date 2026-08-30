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
  corpus?: {
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
  ruleMap?: RuleMapping[];
  candidates: Candidate[];
  /** Individual tests, each charted on its own. Absent entries derive four from the timing statistics. */
  tests?: BenchmarkTest[];
  /** Titled sub-benchmarks, each with its own candidates and charts. When present, top-level candidates may be empty. */
  sections?: BenchmarkSection[];
  limitations: string[];
  /** Logo and trademark notices for the products under test, shown under the limitations. */
  trademarks?: string[];
}

export interface BenchmarkSection {
  id: string;
  title: string;
  deck: string;
  unit: string;
  lowerIsBetter: boolean;
  verdict: {
    winnerId: string;
    headline: string;
    summary: string;
  };
  candidates: Candidate[];
  tests?: BenchmarkTest[];
}

/** One charted test in the barefeats sense: a title, what was measured, and one value per candidate. */
export interface BenchmarkTest {
  id: string;
  title: string;
  description: string;
  unit: string;
  lowerIsBetter: boolean;
  results: TestResult[];
}

export interface TestResult {
  candidateId: string;
  value: number;
}

/** One matched intent; every other key is a candidate id mapped to that candidate's rule name. */
export interface RuleMapping {
  intent: string;
  [candidateId: string]: string;
}

export interface Candidate {
  id: string;
  name: string;
  version: string;
  /** Site-relative path to the product's logo, self-hosted under public/logos. */
  logo?: string;
  /** The product's brand color as a hex string; charts mix it per theme for contrast. */
  color?: string;
  homepage?: string;
  statistics: Statistics;
  samplesMs: number[];
  configuration?: {
    engine: string;
    topology: "plaintext" | "tls-inprocess" | "proxyv2-haproxy";
    workload: "hit-path-rps" | "segment-serve" | "segment-serve-range" | "miss-storm" | "origin-flap";
    targetRps?: number;
    concurrency?: number;
  };
  metrics?: Record<string, { value: number; unit: string; label?: string }>;
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
