export type Engine = "varnish" | "vinyl" | "nginx";
export type Topology = "plaintext" | "tls-inprocess" | "proxyv2-haproxy";
export type Workload = "hit-path-rps" | "segment-serve" | "miss-storm" | "origin-flap";

export interface Session {
  engine: Engine;
  topology: Topology;
  workload: Workload;
  label: string;
}

export interface WorkloadConfig {
  path: string;
  rps: number;
  concurrency: number;
  duration: string;
  warmupSeconds: number;
  measuredBuckets: number;
  reps?: number;
  rangeVariant?: boolean;
}

const W1_CONFIG: WorkloadConfig = {
  path: "/stream/master.m3u8",
  rps: 5000,
  concurrency: 50,
  duration: "23s",
  warmupSeconds: 3,
  measuredBuckets: 20,
};

const W2_CONFIG: WorkloadConfig = {
  path: "/stream/segment-0.ts",
  rps: 500,
  concurrency: 20,
  duration: "23s",
  warmupSeconds: 3,
  measuredBuckets: 20,
  rangeVariant: true,
};

const W3_CONFIG: WorkloadConfig = {
  path: "/stream/segment-{REP}.ts",
  rps: 0,
  concurrency: 200,
  duration: "0s",
  warmupSeconds: 0,
  measuredBuckets: 0,
  reps: 20,
};

const W4_CONFIG: WorkloadConfig = {
  path: "/stream/segment-0.ts",
  rps: 200,
  concurrency: 10,
  duration: "10s",
  warmupSeconds: 0,
  measuredBuckets: 0,
  reps: 5,
};

const W3_SMOKE: WorkloadConfig = {
  path: "/stream/segment-{REP}.ts",
  rps: 0,
  concurrency: 50,
  duration: "0s",
  warmupSeconds: 0,
  measuredBuckets: 0,
  reps: 3,
};

const W4_SMOKE: WorkloadConfig = {
  path: "/stream/segment-0.ts",
  rps: 100,
  concurrency: 5,
  duration: "5s",
  warmupSeconds: 0,
  measuredBuckets: 0,
  reps: 2,
};

const smokeMode = process.argv.includes("--smoke");

export function workloadConfig(w: Workload): WorkloadConfig {
  switch (w) {
    case "hit-path-rps": return W1_CONFIG;
    case "segment-serve": return W2_CONFIG;
    case "miss-storm": return smokeMode ? W3_SMOKE : W3_CONFIG;
    case "origin-flap": return smokeMode ? W4_SMOKE : W4_CONFIG;
  }
}

const ALL_TOPOLOGIES: Topology[] = ["plaintext", "tls-inprocess", "proxyv2-haproxy"];
const ENGINES: Engine[] = ["varnish", "vinyl", "nginx"];

function isFeasible(engine: Engine, topology: Topology): boolean {
  if (engine === "vinyl" && topology === "tls-inprocess") return false;
  return true;
}

export function buildMatrix(smoke = false): Session[] {
  const sessions: Session[] = [];

  for (const engine of ENGINES) {
    for (const topology of ALL_TOPOLOGIES) {
      if (!isFeasible(engine, topology)) continue;

      const workloads: Workload[] =
        topology === "plaintext"
          ? ["hit-path-rps", "segment-serve", "miss-storm", "origin-flap"]
          : ["hit-path-rps", "segment-serve"];

      for (const workload of workloads) {
        sessions.push({
          engine,
          topology,
          workload,
          label: `${engine}/${topology}/${workload}`,
        });
      }
    }
  }

  if (smoke) {
    return sessions.filter(
      (s) => s.topology === "plaintext" && s.workload !== "segment-serve",
    );
  }

  return sessions;
}

export function composeFiles(session: Session): string[] {
  const base = `docker-compose.${session.engine}.yml`;
  const files = [base];

  if (session.topology === "tls-inprocess") {
    files.push(`topology-tls.${session.engine}.yml`);
  } else if (session.topology === "proxyv2-haproxy") {
    files.push("topology-proxyv2.yml");
    files.push(`topology-proxyv2.${session.engine}.yml`);
  }

  return files;
}

const ENGINE_HOST = process.env.ENGINE_HOST ?? "localhost";
const ENGINE_PORT = process.env.ENGINE_PORT;
const ENGINE_TLS_PORT = process.env.ENGINE_TLS_PORT;

export function targetUrl(session: Session, path: string): string {
  if (session.topology === "plaintext") {
    const port = ENGINE_PORT ?? "6081";
    return `http://${ENGINE_HOST}:${port}${path}`;
  }
  const port = ENGINE_TLS_PORT ?? "6443";
  return `https://${ENGINE_HOST}:${port}${path}`;
}
