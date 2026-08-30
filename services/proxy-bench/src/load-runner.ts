import { type Session, composeFiles, targetUrl, workloadConfig } from "./matrix";
import { collectStats, type EngineStats } from "./engine-stats";
import { getOriginRequestCount, toggleFlap } from "./origin-client";

export interface OhaResult {
  p50Ms: number;
  p99Ms: number;
  rps: number;
  errorRate: number;
  totalRequests: number;
  statusCodes: Record<string, number>;
}

export interface CellResult {
  session: Session;
  samplesMs: number[];
  p50Ms: number;
  p99Ms: number;
  achievedRps: number;
  errorRate: number;
  engineStats: EngineStats;
  metrics: Record<string, { value: number; unit: string; label?: string }>;
}

const COMPOSE_DIR = new URL("../compose/", import.meta.url).pathname;

function composeCmd(session: Session, subcommand: string[]): string[] {
  const files = composeFiles(session);
  const project = projectName(session);
  const args = ["docker", "compose", "--project-directory", COMPOSE_DIR];
  for (const f of files) {
    args.push("-f", `${COMPOSE_DIR}${f}`);
  }
  args.push("-p", project, ...subcommand);
  return args;
}

export function projectName(session: Session): string {
  return `bench-${session.engine}-${session.topology}`;
}

export async function composeUp(session: Session): Promise<void> {
  const cmd = composeCmd(session, ["up", "-d", "--build", "--wait", "--wait-timeout", "120"]);
  console.log(`  compose up: ${projectName(session)}`);
  const result = Bun.spawnSync(cmd, { stderr: "inherit", timeout: 180_000 });
  if (result.exitCode !== 0) {
    throw new Error(`compose up failed for ${session.label} (exit ${result.exitCode})`);
  }
  const url = targetUrl(session, "/stream/master.m3u8");
  const insecure = session.topology !== "plaintext";
  for (let i = 0; i < 30; i++) {
    const check = Bun.spawnSync(["curl", "-sf", "-o", "/dev/null", ...(insecure ? ["-k"] : []), url]);
    if (check.exitCode === 0) break;
    await Bun.sleep(1000);
  }
  await Bun.sleep(1000);
}

export async function composeDown(session: Session): Promise<void> {
  const cmd = composeCmd(session, ["down", "-v", "--remove-orphans"]);
  console.log(`  compose down: ${projectName(session)}`);
  Bun.spawnSync(cmd, { stderr: "inherit" });
}

function parseOhaJson(output: string): OhaResult {
  const data = JSON.parse(output) as {
    summary: { average: number; slowest: number; fastest: number; requestsPerSec: number; total: number };
    latencyPercentiles: Record<string, number>;
    statusCodeDistribution: Record<string, number>;
  };

  const p50 = data.latencyPercentiles?.p50 ?? data.summary.average;
  const p99 = data.latencyPercentiles?.p99 ?? data.summary.slowest;

  const statusCodes: Record<string, number> = data.statusCodeDistribution ?? {};
  const totalRequests = Object.values(statusCodes).reduce((a, b) => a + b, 0);
  const successCount = (statusCodes["200"] ?? 0) + (statusCodes["206"] ?? 0);
  const errorRate = totalRequests > 0 ? 1 - successCount / totalRequests : 0;

  return { p50Ms: p50 * 1000, p99Ms: p99 * 1000, rps: data.summary.requestsPerSec, errorRate, totalRequests, statusCodes };
}

function oha(url: string, opts: { rps?: number; concurrency: number; duration: string; insecure?: boolean; extraHeaders?: string[] }): OhaResult {
  const args = ["oha", "--output-format", "json", "--latency-correction", "--no-tui"];
  if (opts.rps && opts.rps > 0) args.push("-q", String(opts.rps));
  args.push("-c", String(opts.concurrency), "-z", opts.duration);
  if (opts.insecure) args.push("--insecure");
  for (const h of opts.extraHeaders ?? []) args.push("-H", h);
  args.push(url);
  console.log(`    oha: ${args.slice(0, -1).join(" ")} <url>`);
  const result = Bun.spawnSync(args, { timeout: 120_000 });
  if (result.exitCode !== 0) throw new Error(`oha failed (exit ${result.exitCode}): ${result.stderr.toString().slice(0, 200)}`);
  return parseOhaJson(result.stdout.toString());
}

function ohaBurst(url: string, n: number, insecure: boolean): OhaResult {
  const args = ["oha", "--output-format", "json", "--latency-correction", "--no-tui", "-c", String(n), "-n", String(n)];
  if (insecure) args.push("--insecure");
  args.push(url);
  console.log(`    oha burst: n=${n}`);
  const result = Bun.spawnSync(args, { timeout: 60_000 });
  if (result.exitCode !== 0) throw new Error(`oha burst failed: ${result.stderr.toString().slice(0, 200)}`);
  return parseOhaJson(result.stdout.toString());
}

function warmCache(session: Session): void {
  const insecure = session.topology !== "plaintext";
  for (const path of ["/stream/master.m3u8", "/stream/segment-0.ts"]) {
    const args = ["curl", "-sf", "-o", "/dev/null", ...(insecure ? ["-k"] : []), targetUrl(session, path)];
    for (let i = 0; i < 3; i++) Bun.spawnSync(args);
  }
}

export async function runW1(session: Session): Promise<CellResult> {
  const config = workloadConfig("hit-path-rps");
  const insecure = session.topology !== "plaintext";
  warmCache(session);
  const ohaOpts = { rps: config.rps, concurrency: config.concurrency, duration: config.duration, insecure };
  console.log(`  W1: hit-path RPS (target ${config.rps} rps, ${config.warmupSeconds} warmup + ${config.measuredBuckets} measured passes, ${config.duration} each)`);

  for (let i = 0; i < config.warmupSeconds; i++) {
    console.log(`    warmup ${i + 1}/${config.warmupSeconds}`);
    oha(targetUrl(session, config.path), ohaOpts);
  }

  const p99Samples: number[] = [];
  const p50Samples: number[] = [];
  let totalRps = 0;
  let maxErr = 0;
  for (let i = 0; i < config.measuredBuckets; i++) {
    console.log(`    pass ${i + 1}/${config.measuredBuckets}`);
    const pass = oha(targetUrl(session, config.path), ohaOpts);
    p99Samples.push(pass.p99Ms);
    p50Samples.push(pass.p50Ms);
    totalRps += pass.rps;
    maxErr = Math.max(maxErr, pass.errorRate);
  }

  const avgRps = totalRps / config.measuredBuckets;
  const medP50 = pct(p50Samples, 0.5);
  const medP99 = pct(p99Samples, 0.5);
  const stats = await collectStats(session.engine, projectName(session));

  return {
    session: { ...session, workload: "hit-path-rps" },
    samplesMs: p99Samples, p50Ms: medP50, p99Ms: medP99,
    achievedRps: avgRps, errorRate: maxErr, engineStats: stats,
    metrics: {
      p50_ttfb: { value: r(medP50, 3), unit: "ms", label: "p50 TTFB" },
      p99_ttfb: { value: r(medP99, 3), unit: "ms", label: "p99 TTFB" },
      achieved_rps: { value: r(avgRps, 1), unit: "rps", label: "Achieved RPS" },
      error_rate: { value: r(maxErr * 100, 2), unit: "%", label: "Error rate" },
      rss_mb: { value: r(stats.rssMb, 1), unit: "MB", label: "Engine RSS" },
      hit_ratio: { value: r((stats.hitRatio ?? 0) * 100, 1), unit: "%", label: "Hit ratio" },
    },
  };
}

export async function runW2(session: Session): Promise<CellResult[]> {
  const config = workloadConfig("segment-serve");
  const insecure = session.topology !== "plaintext";
  const results: CellResult[] = [];
  const url = targetUrl(session, config.path);

  warmCache(session);

  // Full GET: warmup + measured passes
  console.log(`  W2: segment serve full GET (target ${config.rps} rps, ${config.warmupSeconds} warmup + ${config.measuredBuckets} measured, ${config.duration} each)`);
  const fullOpts = { rps: config.rps, concurrency: config.concurrency, duration: config.duration, insecure };
  for (let i = 0; i < config.warmupSeconds; i++) {
    console.log(`    full warmup ${i + 1}/${config.warmupSeconds}`);
    oha(url, fullOpts);
  }
  const fullP99: number[] = [];
  const fullP50: number[] = [];
  let fullTotalRps = 0;
  let fullMaxErr = 0;
  for (let i = 0; i < config.measuredBuckets; i++) {
    console.log(`    full pass ${i + 1}/${config.measuredBuckets}`);
    const pass = oha(url, fullOpts);
    fullP99.push(pass.p99Ms);
    fullP50.push(pass.p50Ms);
    fullTotalRps += pass.rps;
    fullMaxErr = Math.max(fullMaxErr, pass.errorRate);
  }
  const fullAvgRps = fullTotalRps / config.measuredBuckets;
  const fullMedP50 = pct(fullP50, 0.5);
  const fullMedP99 = pct(fullP99, 0.5);
  const stats = await collectStats(session.engine, projectName(session));
  results.push({
    session: { ...session, workload: "segment-serve" },
    samplesMs: fullP99, p50Ms: fullMedP50, p99Ms: fullMedP99,
    achievedRps: fullAvgRps, errorRate: fullMaxErr, engineStats: stats,
    metrics: {
      p50_ttfb: { value: r(fullMedP50, 3), unit: "ms", label: "p50 TTFB" },
      p99_ttfb: { value: r(fullMedP99, 3), unit: "ms", label: "p99 TTFB" },
      achieved_rps: { value: r(fullAvgRps, 1), unit: "rps", label: "Achieved RPS" },
      error_rate: { value: r(fullMaxErr * 100, 2), unit: "%", label: "Error rate" },
    },
  });

  // Range GET: warmup + measured passes
  console.log(`  W2: segment serve Range GET (bytes=0-65535, ${config.warmupSeconds} warmup + ${config.measuredBuckets} measured, ${config.duration} each)`);
  try {
    const rangeOpts = { ...fullOpts, extraHeaders: ["Range: bytes=0-65535"] };
    for (let i = 0; i < config.warmupSeconds; i++) {
      console.log(`    range warmup ${i + 1}/${config.warmupSeconds}`);
      oha(url, rangeOpts);
    }
    const rangeP99: number[] = [];
    const rangeP50: number[] = [];
    let rangeTotalRps = 0;
    let rangeMaxErr = 0;
    for (let i = 0; i < config.measuredBuckets; i++) {
      console.log(`    range pass ${i + 1}/${config.measuredBuckets}`);
      const pass = oha(url, rangeOpts);
      rangeP99.push(pass.p99Ms);
      rangeP50.push(pass.p50Ms);
      rangeTotalRps += pass.rps;
      rangeMaxErr = Math.max(rangeMaxErr, pass.errorRate);
    }
    const rangeAvgRps = rangeTotalRps / config.measuredBuckets;
    const rangeMedP50 = pct(rangeP50, 0.5);
    const rangeMedP99 = pct(rangeP99, 0.5);
    results.push({
      session: { ...session, workload: "segment-serve" },
      samplesMs: rangeP99, p50Ms: rangeMedP50, p99Ms: rangeMedP99,
      achievedRps: rangeAvgRps, errorRate: rangeMaxErr, engineStats: stats,
      metrics: {
        p50_ttfb: { value: r(rangeMedP50, 3), unit: "ms", label: "p50 TTFB (Range)" },
        p99_ttfb: { value: r(rangeMedP99, 3), unit: "ms", label: "p99 TTFB (Range)" },
        achieved_rps: { value: r(rangeAvgRps, 1), unit: "rps", label: "Achieved RPS (Range)" },
        variant: { value: 1, unit: "", label: "Range GET" },
      },
    });
  } catch (err) {
    console.error(`    Range GET failed: ${err instanceof Error ? err.message : err}`);
  }

  return results;
}

export async function runW3(session: Session): Promise<CellResult> {
  const config = workloadConfig("miss-storm");
  const insecure = session.topology !== "plaintext";
  const reps = config.reps ?? 20;
  const samples: number[] = [];
  let totalOriginRequests = 0;

  console.log(`  W3: miss-storm (${reps} reps, ${config.concurrency} concurrent)`);

  for (let rep = 0; rep < reps; rep++) {
    const segPath = `/stream/segment-${10000 + rep}.ts`;
    const burst = ohaBurst(targetUrl(session, segPath), config.concurrency, insecure);
    samples.push(burst.p99Ms);
    const originHits = await getOriginRequestCount(segPath);
    totalOriginRequests += originHits;
    if (rep % 5 === 0) console.log(`    rep ${rep}: p99=${r(burst.p99Ms, 2)}ms, origin=${originHits}`);
  }

  const avgOrigin = totalOriginRequests / reps;
  const coalescingEff = config.concurrency / avgOrigin;
  const stats = await collectStats(session.engine, projectName(session));

  return {
    session: { ...session, workload: "miss-storm" },
    samplesMs: samples, p50Ms: pct(samples, 0.5), p99Ms: pct(samples, 0.99),
    achievedRps: 0, errorRate: 0, engineStats: stats,
    metrics: {
      p50_ttfb: { value: r(pct(samples, 0.5), 3), unit: "ms", label: "p50 TTFB" },
      p99_ttfb: { value: r(pct(samples, 0.99), 3), unit: "ms", label: "p99 TTFB" },
      avg_origin_requests: { value: r(avgOrigin, 1), unit: "", label: "Avg origin requests per burst" },
      coalescing_efficiency: { value: r(coalescingEff, 1), unit: "x", label: "Coalescing efficiency" },
      total_origin_requests: { value: totalOriginRequests, unit: "", label: "Total origin requests" },
      rss_mb: { value: r(stats.rssMb, 1), unit: "MB", label: "Engine RSS" },
    },
  };
}

export async function runW4(session: Session): Promise<CellResult> {
  const config = workloadConfig("origin-flap");
  const insecure = session.topology !== "plaintext";
  const cycles = config.reps ?? 5;
  const samples: number[] = [];
  let graceServed = 0;
  let errorsServed = 0;

  console.log(`  W4: origin-flap (${cycles} cycles, baseline/flap/recovery)`);
  warmCache(session);
  await Bun.sleep(1000);

  for (let c = 0; c < cycles; c++) {
    console.log(`    cycle ${c}: baseline`);
    const baseline = oha(targetUrl(session, config.path), { rps: config.rps, concurrency: config.concurrency, duration: config.duration, insecure });
    samples.push(baseline.p99Ms);

    console.log(`    cycle ${c}: flap (origin 500s)`);
    await toggleFlap();
    const flap = oha(targetUrl(session, config.path), { rps: config.rps, concurrency: config.concurrency, duration: config.duration, insecure });
    samples.push(flap.p99Ms);
    const flapOk = (flap.statusCodes["200"] ?? 0) + (flap.statusCodes["206"] ?? 0);
    graceServed += flapOk;
    errorsServed += flap.totalRequests - flapOk;

    console.log(`    cycle ${c}: recovery`);
    await toggleFlap();
    await Bun.sleep(2000);
    const recovery = oha(targetUrl(session, config.path), { rps: config.rps, concurrency: config.concurrency, duration: config.duration, insecure });
    samples.push(recovery.p99Ms);
  }

  const stats = await collectStats(session.engine, projectName(session));
  const total = graceServed + errorsServed;

  return {
    session: { ...session, workload: "origin-flap" },
    samplesMs: samples, p50Ms: pct(samples, 0.5), p99Ms: pct(samples, 0.99),
    achievedRps: 0, errorRate: total > 0 ? errorsServed / total : 0, engineStats: stats,
    metrics: {
      p50_ttfb: { value: r(pct(samples, 0.5), 3), unit: "ms", label: "p50 TTFB" },
      p99_ttfb: { value: r(pct(samples, 0.99), 3), unit: "ms", label: "p99 TTFB" },
      grace_served: { value: graceServed, unit: "", label: "Grace responses during flap" },
      errors_served: { value: errorsServed, unit: "", label: "Error responses during flap" },
      grace_ratio: { value: r(total > 0 ? (graceServed / total) * 100 : 0, 1), unit: "%", label: "Grace hit ratio" },
      rss_mb: { value: r(stats.rssMb, 1), unit: "MB", label: "Engine RSS" },
    },
  };
}

function r(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = p * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}
