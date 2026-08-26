export interface Summary {
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarize(samples: number[]): Summary {
  if (samples.length === 0) {
    throw new Error("At least one sample is required.");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2 : (sorted[midpoint] ?? 0);
  const mean = sorted.reduce((total, sample) => total + sample, 0) / sorted.length;

  return {
    medianMs: roundToTenth(median),
    meanMs: roundToTenth(mean),
    minMs: roundToTenth(sorted[0] ?? 0),
    maxMs: roundToTenth(sorted.at(-1) ?? 0),
  };
}

export function relativeSpeedup(slowerMedianMs: number, fasterMedianMs: number): number {
  if (fasterMedianMs <= 0) {
    throw new Error("The faster duration must be positive.");
  }

  return Math.floor((slowerMedianMs / fasterMedianMs) * 10) / 10;
}
