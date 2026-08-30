import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCatalog } from "../src/catalog";
import type { Benchmark, BenchmarkRun, BenchmarkSection, Candidate } from "../src/types";

interface RegistryEntry {
  slug: string;
  repo: string;
  ref: string;
}

interface Registry {
  schemaVersion: number;
  benchmarks: RegistryEntry[];
}

interface RunnerBenchmark {
  schemaVersion: number;
  id: string;
  slug: string;
  category: string;
  title: string;
  deck: string;
  unit: "ms";
  lowerIsBetter: boolean;
  verdict: Benchmark["verdict"];
  corpus?: Benchmark["corpus"];
  ruleMap?: Benchmark["ruleMap"];
  limitations: string[];
  trademarks?: string[];
  runs: string[];
}

interface RunFile {
  schemaVersion: number;
  id: string;
  label: string;
  publishedAt: string;
  environment: Benchmark["environment"];
  protocol: Benchmark["protocol"];
  candidates?: Candidate[];
  sections?: BenchmarkSection[];
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const RUN_PATH_PATTERN = /^runs\/[A-Za-z0-9._-]+\.json$/;

export function validateRef(ref: string): void {
  if (!SHA_PATTERN.test(ref)) throw new Error(`Invalid ref "${ref}" — expected a 40-character hex SHA`);
}

export function validateRunPath(path: string): void {
  if (!RUN_PATH_PATTERN.test(path)) throw new Error(`Invalid run path "${path}" — must match runs/<name>.json`);
}

async function fetchRaw(repo: string, ref: string, path: string): Promise<unknown> {
  const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

const root = join(import.meta.dir, "..");
const registry: Registry = JSON.parse(await readFile(join(root, "data", "registry.json"), "utf8"));
const cacheDir = join(root, "data", "cache");
await mkdir(cacheDir, { recursive: true });

const buffered: { path: string; content: string }[] = [];
const manifest: Record<string, { repo: string; ref: string }> = {};

for (const entry of registry.benchmarks) {
  validateRef(entry.ref);

  const meta = (await fetchRaw(entry.repo, entry.ref, "benchmark.json")) as RunnerBenchmark;

  if (meta.slug !== entry.slug) {
    throw new Error(`Slug mismatch for ${entry.slug}: registry says "${entry.slug}" but benchmark.json says "${meta.slug}"`);
  }

  if (meta.runs.length === 0) {
    throw new Error(`Benchmark ${entry.slug} has no runs — benchmark.json must list at least one run file`);
  }

  for (const runPath of meta.runs) {
    validateRunPath(runPath);
  }

  const runs: RunFile[] = [];
  for (const runPath of meta.runs) {
    runs.push((await fetchRaw(entry.repo, entry.ref, runPath)) as RunFile);
  }

  const primary = runs[0]!;

  const benchmark: Benchmark = {
    id: meta.id,
    slug: meta.slug,
    category: meta.category,
    title: meta.title,
    deck: meta.deck,
    publishedAt: primary.publishedAt,
    unit: meta.unit,
    lowerIsBetter: meta.lowerIsBetter,
    verdict: meta.verdict,
    ...(meta.corpus ? { corpus: meta.corpus } : {}),
    environment: primary.environment,
    protocol: primary.protocol,
    ...(meta.ruleMap ? { ruleMap: meta.ruleMap } : {}),
    candidates: primary.candidates ?? [],
    ...(primary.sections ? { sections: primary.sections } : {}),
    limitations: meta.limitations,
    ...(meta.trademarks ? { trademarks: meta.trademarks } : {}),
    runnerUrl: `https://github.com/${entry.repo}`,
  };

  if (runs.length > 1) {
    benchmark.runs = runs.slice(1).map(
      (run): BenchmarkRun => ({
        id: run.id,
        label: run.label,
        environment: run.environment,
        protocol: run.protocol,
        publishedAt: run.publishedAt,
        ...(run.sections ? { sections: run.sections } : {}),
        ...((run.candidates?.length ?? 0) > 0 ? { candidates: run.candidates } : {}),
      }),
    );
  }

  parseCatalog({ schemaVersion: 1, generatedAt: new Date().toISOString(), benchmarks: [benchmark], queue: [] });

  buffered.push({ path: join(cacheDir, `${entry.slug}.json`), content: JSON.stringify(benchmark, null, 2) + "\n" });
  manifest[entry.slug] = { repo: entry.repo, ref: entry.ref };
  console.log(`  ${entry.slug} ← ${entry.repo}@${entry.ref.slice(0, 7)}`);
}

buffered.push({ path: join(cacheDir, "manifest.json"), content: JSON.stringify(manifest, null, 2) + "\n" });

for (const file of buffered) {
  await writeFile(file.path, file.content);
}

console.log(`Synced ${Object.keys(manifest).length} benchmarks`);
