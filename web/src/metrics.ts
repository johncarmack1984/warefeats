import type { Benchmark, BenchmarkSection, BenchmarkTest, Candidate } from "./types";

export function formatDuration(value: number, unit = "ms"): string {
  if (unit === "ms" && value >= 1000) {
    return `${(value / 1000).toFixed(3)} s`;
  }

  return `${value.toFixed(1)} ${unit}`;
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }

  return `${(bytes / 1_000).toFixed(1)} kB`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
}

/** Sample standard deviation, as hyperfine reports σ. */
export function standardDeviation(samples: number[]): number {
  if (samples.length < 2) {
    return 0;
  }

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (samples.length - 1);
  return Math.sqrt(variance);
}

export interface Comparison {
  other: Candidate;
  ratio: number;
  sigma: number;
}

export interface Summary {
  winner: Candidate;
  comparisons: Comparison[];
}

/**
 * The hyperfine summary: how many times faster the winner ran than each other candidate,
 * with the propagated uncertainty ratio * sqrt((σa/μa)² + (σb/μb)²).
 */
export function summarize(benchmark: Benchmark): Summary {
  if (benchmark.candidates.length === 0) {
    return { winner: { id: "", name: "", version: "", statistics: { medianMs: 0, meanMs: 0, minMs: 0, maxMs: 0 }, samplesMs: [] }, comparisons: [] };
  }

  const winner = benchmark.candidates.find((candidate) => candidate.id === benchmark.verdict.winnerId) ?? benchmark.candidates[0];

  if (!winner) {
    throw new Error(`Benchmark ${benchmark.id} has no candidates.`);
  }

  const winnerMean = winner.statistics.meanMs;
  const winnerSigma = standardDeviation(winner.samplesMs);

  const comparisons = benchmark.candidates
    .filter((candidate) => candidate.id !== winner.id)
    .map((other) => {
      const otherMean = other.statistics.meanMs;
      const otherSigma = standardDeviation(other.samplesMs);
      const ratio = benchmark.lowerIsBetter ? otherMean / winnerMean : winnerMean / otherMean;
      const sigma = ratio * Math.sqrt((winnerSigma / winnerMean) ** 2 + (otherSigma / otherMean) ** 2);
      return { other, ratio, sigma };
    })
    .sort((a, b) => a.ratio - b.ratio);

  return { winner, comparisons };
}

export function formatRatio(comparison: Comparison): string {
  return `${comparison.ratio.toFixed(2)} ± ${comparison.sigma.toFixed(2)}`;
}

export function samplePosition(value: number, min: number, max: number): number {
  if (min === max) {
    return 50;
  }

  return ((value - min) / (max - min)) * 100;
}

/** Shared axis bounds across every candidate so the gap between tools is visible. */
export function sampleRange(benchmark: Benchmark): { min: number; max: number } {
  const all = benchmark.candidates.flatMap((candidate) => candidate.samplesMs);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.06 || 1;
  return { min: min - pad, max: max + pad };
}

/** Evenly spaced axis ticks rounded to a friendly step. */
export function axisTicks(min: number, max: number, count = 5): number[] {
  const rawStep = (max - min) / (count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude);
  const step = candidates.find((value) => value >= rawStep) ?? candidates[candidates.length - 1]!;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];

  for (let tick = first; tick <= max + step * 0.001; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return ticks;
}

/** The report as hyperfine prints it, for the clipboard. */
export function reportText(benchmark: Benchmark): string {
  const lines: string[] = [];

  benchmark.candidates.forEach((candidate, index) => {
    const sigma = standardDeviation(candidate.samplesMs);
    lines.push(`Benchmark ${index + 1}: ${candidate.name} ${candidate.version}`);
    lines.push(`  Time (mean ± σ):     ${formatDuration(candidate.statistics.meanMs).padStart(10)} ± ${formatDuration(sigma).padStart(8)}`);
    lines.push(`  Range (min … max):   ${formatDuration(candidate.statistics.minMs).padStart(10)} … ${formatDuration(candidate.statistics.maxMs).padStart(8)}    ${candidate.samplesMs.length} runs`);
    lines.push("");
  });

  const summary = summarize(benchmark);
  lines.push("Summary");
  lines.push(`  ${summary.winner.name} ${summary.winner.version} ran`);
  for (const comparison of summary.comparisons) {
    lines.push(`    ${formatRatio(comparison)} times faster than ${comparison.other.name} ${comparison.other.version}`);
  }
  lines.push("");
  lines.push(`Rig: ${benchmark.environment.machine}, ${benchmark.environment.chip}, ${benchmark.environment.memory}, ${benchmark.environment.os}`);
  lines.push(`Source: https://warefeats.com/benchmarks/${benchmark.slug}/`);

  return lines.join("\n");
}

/** The tests a benchmark charts as bar graphs. A run with only its timing distribution charts a box plot instead. */
export function benchmarkTests(benchmark: Benchmark): BenchmarkTest[] {
  return benchmark.tests ?? [];
}

export interface FiveNumber {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** Five-number summary with quartiles by linear interpolation (the R-7 / NumPy default). */
export function fiveNumber(samples: number[]): FiveNumber {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number): number => {
    if (sorted.length === 0) {
      return 0;
    }
    const position = (sorted.length - 1) * p;
    const low = Math.floor(position);
    const high = Math.ceil(position);
    const weight = position - low;
    return sorted[low]! * (1 - weight) + sorted[high]! * weight;
  };

  return { min: at(0), q1: at(0.25), median: at(0.5), q3: at(0.75), max: at(1) };
}

export function testWinner(test: BenchmarkTest): string | undefined {
  const sorted = [...test.results].sort((a, b) => (test.lowerIsBetter ? a.value - b.value : b.value - a.value));
  return sorted[0]?.candidateId;
}

export function formatValue(value: number, unit: string): string {
  return unit === "ms" ? formatDuration(value) : `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

export interface ScorecardColumn {
  id: string;
  title: string;
  unit: string;
  lowerIsBetter: boolean;
  /** The candidate with the best displayed value in this column, or null when the column is empty. */
  bestId: string | null;
}

export interface ScorecardRow {
  candidateId: string;
  name: string;
  /** One entry per column: the candidate's mean in that section, or null where it did not run. */
  cells: (number | null)[];
}

export interface Scorecard {
  columns: ScorecardColumn[];
  rows: ScorecardRow[];
}

/**
 * One row per candidate, one column per section, each cell the mean of that section's samples (the
 * statistic the section's charts and the hyperfine summary already use). The best value in each
 * column is computed from the cells themselves, so the mark always agrees with the number shown.
 * Candidates keep the order of their first appearance; a candidate absent from a section leaves that
 * cell empty.
 */
export function scorecard(sections: BenchmarkSection[]): Scorecard {
  const order: string[] = [];
  const names = new Map<string, string>();
  for (const section of sections) {
    for (const candidate of section.candidates) {
      if (!names.has(candidate.id)) {
        order.push(candidate.id);
        names.set(candidate.id, candidate.name);
      }
    }
  }
  const rows = order.map((candidateId) => ({
    candidateId,
    name: names.get(candidateId) ?? candidateId,
    cells: sections.map((section) => section.candidates.find((candidate) => candidate.id === candidateId)?.statistics.meanMs ?? null),
  }));
  const columns = sections.map((section, index) => {
    let bestId: string | null = null;
    let best: number | null = null;
    for (const row of rows) {
      const value = row.cells[index];
      if (value === null || value === undefined) continue;
      if (best === null || (section.lowerIsBetter ? value < best : value > best)) {
        best = value;
        bestId = row.candidateId;
      }
    }
    return { id: section.id, title: section.title, unit: section.unit, lowerIsBetter: section.lowerIsBetter, bestId };
  });
  return { columns, rows };
}
