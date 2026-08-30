import type { Engine } from "./matrix";

export interface EngineStats {
  rssMb: number;
  cacheHits?: number;
  cacheMisses?: number;
  hitRatio?: number;
}

async function dockerStats(containerName: string): Promise<number> {
  const result = Bun.spawnSync(["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}", containerName]);
  const output = result.stdout.toString().trim();
  const match = output.match(/([\d.]+)(MiB|GiB)/);
  if (!match) return 0;
  const value = parseFloat(match[1]!);
  return match[2] === "GiB" ? value * 1024 : value;
}

async function varnishStat(containerName: string, binary: string): Promise<{ hits: number; misses: number }> {
  const result = Bun.spawnSync([
    "docker", "exec", containerName, binary, "-1",
    "-f", "MAIN.cache_hit",
    "-f", "MAIN.cache_miss",
  ], { timeout: 10_000 });
  const output = result.stdout.toString();
  let hits = 0;
  let misses = 0;
  for (const line of output.split("\n")) {
    if (line.includes("cache_hit")) {
      hits = parseInt(line.trim().split(/\s+/)[1] ?? "0", 10);
    } else if (line.includes("cache_miss")) {
      misses = parseInt(line.trim().split(/\s+/)[1] ?? "0", 10);
    }
  }
  return { hits, misses };
}

async function nginxHitMiss(containerName: string): Promise<{ hits: number; misses: number }> {
  const result = Bun.spawnSync(["docker", "logs", containerName], { timeout: 10_000 });
  const log = result.stdout.toString();
  let hits = 0;
  let misses = 0;
  for (const line of log.split("\n")) {
    if (line.includes('"HIT"') || line.includes("HIT")) hits++;
    else if (line.includes('"MISS"') || line.includes("MISS")) misses++;
  }
  return { hits, misses };
}

export async function collectStats(engine: Engine, projectName: string): Promise<EngineStats> {
  if (process.env.CLOUD_MODE === "1") {
    return { rssMb: 0 };
  }
  const containerName = `${projectName}-engine-1`;
  const rssMb = await dockerStats(containerName);

  let cacheHits: number | undefined;
  let cacheMisses: number | undefined;
  let hitRatio: number | undefined;

  if (engine === "varnish") {
    const stats = await varnishStat(containerName, "varnishstat");
    cacheHits = stats.hits;
    cacheMisses = stats.misses;
  } else if (engine === "vinyl") {
    const stats = await varnishStat(containerName, "vinylstat");
    cacheHits = stats.hits;
    cacheMisses = stats.misses;
  } else if (engine === "nginx") {
    const stats = await nginxHitMiss(containerName);
    cacheHits = stats.hits;
    cacheMisses = stats.misses;
  }

  if (cacheHits !== undefined && cacheMisses !== undefined) {
    const total = cacheHits + cacheMisses;
    hitRatio = total > 0 ? cacheHits / total : 0;
  }

  return { rssMb, cacheHits, cacheMisses, hitRatio };
}
