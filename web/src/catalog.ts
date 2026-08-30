import type { BenchmarkCatalog } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCatalog(value: unknown): BenchmarkCatalog {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.benchmarks) || !Array.isArray(value.queue)) {
    throw new Error("The benchmark catalog has an unsupported shape.");
  }

  for (const benchmark of value.benchmarks) {
    if (!isRecord(benchmark) || typeof benchmark.id !== "string" || typeof benchmark.title !== "string" || !Array.isArray(benchmark.candidates)) {
      throw new Error("A benchmark entry is incomplete.");
    }

    const hasSections = Array.isArray(benchmark.sections) && benchmark.sections.length > 0;

    if (!hasSections && benchmark.candidates.length < 2) {
      throw new Error(`Benchmark ${benchmark.id} needs at least two candidates.`);
    }

    for (const candidate of benchmark.candidates) {
      if (!isRecord(candidate) || typeof candidate.id !== "string" || !isRecord(candidate.statistics) || !Array.isArray(candidate.samplesMs)) {
        throw new Error(`Benchmark ${benchmark.id} contains an invalid candidate.`);
      }
    }

    if (hasSections) {
      for (const section of benchmark.sections as unknown[]) {
        if (!isRecord(section) || typeof section.id !== "string" || !Array.isArray(section.candidates)) {
          throw new Error(`Benchmark ${benchmark.id} has an invalid section.`);
        }
        if (section.candidates.length < 2) {
          throw new Error(`Section ${section.id} in ${benchmark.id} needs at least two candidates.`);
        }
        for (const candidate of section.candidates) {
          if (!isRecord(candidate) || typeof candidate.id !== "string" || !isRecord(candidate.statistics) || !Array.isArray(candidate.samplesMs)) {
            throw new Error(`Section ${section.id} in ${benchmark.id} contains an invalid candidate.`);
          }
        }
      }
    }
  }

  return value as unknown as BenchmarkCatalog;
}
