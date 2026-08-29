import { buildMatrix, type Session } from "./matrix";
import { type CellResult, composeUp, composeDown, runW1, runW2, runW3, runW4 } from "./load-runner";

const smoke = process.argv.includes("--smoke");
const resume = process.argv.includes("--resume");
const engineFilter = process.argv.find((a) => a.startsWith("--engine="))?.split("=")[1];
const workloadFilter = process.argv.find((a) => a.startsWith("--workload="))?.split("=")[1];
const matrix = buildMatrix(smoke).filter((s) => (!engineFilter || s.engine === engineFilter) && (!workloadFilter || s.workload === workloadFilter));

console.log(`proxy-bench: ${matrix.length} sessions${smoke ? " (smoke)" : ""}${engineFilter ? ` (engine=${engineFilter})` : ""}${resume ? " (resume)" : ""}`);
for (const s of matrix) console.log(`  ${s.label}`);

const outputPath = new URL("../results.json", import.meta.url).pathname;

interface SerializedResult {
  label: string;
  engine: string;
  topology: string;
  workload: string;
  samplesMs: number[];
  p50Ms: number;
  p99Ms: number;
  achievedRps: number;
  errorRate: number;
  engineStats: CellResult["engineStats"];
  metrics: CellResult["metrics"];
}

function serializeResult(r: CellResult): SerializedResult {
  return {
    label: r.session.label, engine: r.session.engine, topology: r.session.topology,
    workload: r.session.workload, samplesMs: r.samplesMs, p50Ms: r.p50Ms, p99Ms: r.p99Ms,
    achievedRps: r.achievedRps, errorRate: r.errorRate, engineStats: r.engineStats, metrics: r.metrics,
  };
}

function loadExisting(): { results: SerializedResult[]; failures: Array<{ label: string; error: string }> } {
  try {
    const data = JSON.parse(require("fs").readFileSync(outputPath, "utf8"));
    return { results: data.results ?? [], failures: data.failures ?? [] };
  } catch { return { results: [], failures: [] }; }
}

function saveResults(newResults: SerializedResult[], newFailures: Array<{ label: string; error: string }>) {
  const existing = loadExisting();
  const newLabels = new Set([...newResults.map((r) => r.label), ...newFailures.map((f) => f.label)]);
  const keptResults = existing.results.filter((r) => !newLabels.has(r.label));
  const keptFailures = existing.failures.filter((f) => !newLabels.has(f.label));
  const mergedResults = [...keptResults, ...newResults];
  const mergedFailures = [...keptFailures, ...newFailures];
  const output = {
    generatedAt: new Date().toISOString(), smoke,
    sessionCount: mergedResults.length + mergedFailures.length,
    resultCount: mergedResults.length, failureCount: mergedFailures.length,
    results: mergedResults, failures: mergedFailures,
  };
  require("fs").writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

const allResults: SerializedResult[] = [];
const failures: Array<{ label: string; error: string }> = [];

interface ComposeCycle {
  anchor: Session;
  workloads: Session[];
}

const cycleMap = new Map<string, ComposeCycle>();
for (const session of matrix) {
  const key = `${session.engine}/${session.topology}`;
  const w = session.workload;
  const isW1W2 = w === "hit-path-rps" || w === "segment-serve";
  const cycleKey = isW1W2 ? `${key}/w1w2` : `${key}/${w}`;
  const existing = cycleMap.get(cycleKey);
  if (existing) {
    existing.workloads.push(session);
  } else {
    cycleMap.set(cycleKey, { anchor: session, workloads: [session] });
  }
}

const cycles = [...cycleMap.values()];
console.log(`\n${cycles.length} compose cycles`);

const completedLabels = resume ? new Set(loadExisting().results.map((r) => r.label)) : new Set<string>();

for (const cycle of cycles) {
  const key = cycle.workloads.map((w) => w.label).join(", ");

  if (resume && cycle.workloads.every((w) => completedLabels.has(w.label))) {
    console.log(`\n--- cycle: ${key} --- SKIPPED (resume) ---`);
    continue;
  }

  console.log(`\n--- cycle: ${key} ---`);

  const cycleResults: SerializedResult[] = [];
  const cycleFailures: Array<{ label: string; error: string }> = [];

  try {
    await composeUp(cycle.anchor);

    for (const session of cycle.workloads) {
      try {
        let results: CellResult[];
        switch (session.workload) {
          case "hit-path-rps":
            results = [await runW1(session)];
            break;
          case "segment-serve":
            results = await runW2(session);
            break;
          case "miss-storm":
            results = [await runW3(session)];
            break;
          case "origin-flap":
            results = [await runW4(session)];
            break;
        }
        for (const r of results) {
          const s = serializeResult(r);
          cycleResults.push(s);
          allResults.push(s);
          console.log(`  => ${r.session.workload}: p50=${r.p50Ms.toFixed(2)}ms p99=${r.p99Ms.toFixed(2)}ms rps=${r.achievedRps.toFixed(0)} err=${(r.errorRate * 100).toFixed(1)}%`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED: ${session.label}: ${msg}`);
        const f = { label: session.label, error: msg };
        cycleFailures.push(f);
        failures.push(f);
      }
    }

    await composeDown(cycle.anchor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAILED cycle: ${msg}`);
    for (const s of cycle.workloads) {
      const f = { label: s.label, error: msg };
      cycleFailures.push(f);
      failures.push(f);
    }
    try { await composeDown(cycle.anchor); } catch {}
  }

  saveResults(cycleResults, cycleFailures);
  console.log(`  [saved ${cycleResults.length} results, ${cycleFailures.length} failures to disk]`);
}

console.log(`\nDone: ${allResults.length} cells completed, ${failures.length} failures`);
console.log(`Results in ${outputPath}`);
