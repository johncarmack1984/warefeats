import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCatalog } from "../src/catalog";
import type { Benchmark, BenchmarkCatalog } from "../src/types";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

interface RegistryEntry {
  slug: string;
  repo: string;
  ref: string;
}

interface Registry {
  schemaVersion: number;
  benchmarks: RegistryEntry[];
}

export async function assembleCatalog(rootOverride?: string): Promise<BenchmarkCatalog> {
  const root = rootOverride ?? join(import.meta.dir, "..");

  const registry: Registry = JSON.parse(await readFile(join(root, "data", "registry.json"), "utf8"));
  const { queue } = JSON.parse(await readFile(join(root, "data", "queue.json"), "utf8"));

  let manifest: Record<string, { repo: string; ref: string }>;
  try {
    manifest = JSON.parse(await readFile(join(root, "data", "cache", "manifest.json"), "utf8"));
  } catch {
    throw new Error("Cache not found — run bun run sync");
  }

  const benchmarks: Benchmark[] = [];

  for (const entry of registry.benchmarks) {
    if (!SHA_PATTERN.test(entry.ref)) throw new Error(`Invalid ref "${entry.ref}" in registry for ${entry.slug}`);
    const cached = manifest[entry.slug];
    if (!cached || cached.ref !== entry.ref) {
      throw new Error(`Cache for ${entry.slug} is stale (expected ${entry.ref.slice(0, 7)}, got ${cached?.ref.slice(0, 7) ?? "missing"}) — run bun run sync`);
    }
    if (!SHA_PATTERN.test(cached.ref)) throw new Error(`Invalid ref "${cached.ref}" in manifest for ${entry.slug}`);
    benchmarks.push(JSON.parse(await readFile(join(root, "data", "cache", `${entry.slug}.json`), "utf8")));
  }

  return parseCatalog({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    benchmarks,
    queue,
  });
}

if (import.meta.main) {
  const catalog = await assembleCatalog();
  const dist = join(import.meta.dir, "..", "dist");
  await mkdir(join(dist, "data"), { recursive: true });
  await writeFile(join(dist, "data", "benchmarks.json"), JSON.stringify(catalog, null, 2));
  console.log(`Assembled catalog: ${catalog.benchmarks.length} benchmarks → dist/data/benchmarks.json`);
}
