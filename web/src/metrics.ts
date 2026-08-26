import type { Benchmark, Candidate, StatisticKey } from "./types";

export const statisticLabels: Record<StatisticKey, string> = {
  medianMs: "Median",
  meanMs: "Mean",
  minMs: "Fastest",
  maxMs: "Slowest",
};

export function formatDuration(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }

  return `${value.toFixed(1)} ms`;
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function speedup(benchmark: Benchmark, statistic: StatisticKey = "medianMs"): number {
  const winner = benchmark.candidates.find((candidate) => candidate.id === benchmark.verdict.winnerId);
  const other = benchmark.candidates.find((candidate) => candidate.id !== benchmark.verdict.winnerId);

  if (!winner || !other) {
    return 1;
  }

  const winnerValue = winner.statistics[statistic];
  const otherValue = other.statistics[statistic];
  const ratio = benchmark.lowerIsBetter ? otherValue / winnerValue : winnerValue / otherValue;
  return Math.floor(ratio * 10) / 10;
}

export function candidateValue(candidate: Candidate, statistic: StatisticKey): number {
  return candidate.statistics[statistic];
}

export function samplePosition(value: number, samples: number[]): number {
  const min = Math.min(...samples);
  const max = Math.max(...samples);

  if (min === max) {
    return 50;
  }

  return ((value - min) / (max - min)) * 100;
}
