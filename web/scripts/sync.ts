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
  candidates: Candidate[];
  sections?: BenchmarkSection[];
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

const manifest: Record<string, { repo: string; ref: string }> = {};

for (const entry of registry.benchmarks) {
  const meta = (await fetchRaw(entry.repo, entry.ref, "benchmark.json")) as RunnerBenchmark;

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
    candidates: primary.candidates,
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
        ...(run.candidates.length > 0 ? { candidates: run.candidates } : {}),
      }),
    );
  }

  parseCatalog({ schemaVersion: 1, generatedAt: new Date().toISOString(), benchmarks: [benchmark], queue: [] });

  await writeFile(join(cacheDir, `${entry.slug}.json`), JSON.stringify(benchmark, null, 2) + "\n");
  manifest[entry.slug] = { repo: entry.repo, ref: entry.ref };
  console.log(`  ${entry.slug} ← ${entry.repo}@${entry.ref.slice(0, 7)}`);
}

await writeFile(join(cacheDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Synced ${Object.keys(manifest).length} benchmarks`);
