const ORIGIN_HOST = process.env.ORIGIN_HOST ?? "localhost";
const ORIGIN_PORT = Number(process.env.ORIGIN_PORT ?? 3100);
const ORIGIN_BASE = `http://${ORIGIN_HOST}:${ORIGIN_PORT}`;

export async function resetStats(): Promise<void> {
  const resp = await fetch(`${ORIGIN_BASE}/_stats/reset`, { method: "POST" });
  if (!resp.ok) throw new Error(`origin reset failed: ${resp.status}`);
}

export async function getOriginRequestCount(path: string): Promise<number> {
  const resp = await fetch(`${ORIGIN_BASE}/_stats/requests?path=${encodeURIComponent(path)}`);
  if (!resp.ok) throw new Error(`origin stats failed: ${resp.status}`);
  const data = (await resp.json()) as { count: number };
  return data.count;
}

export async function toggleFlap(): Promise<boolean> {
  const resp = await fetch(`${ORIGIN_BASE}/_control/flap`, { method: "POST" });
  if (!resp.ok) throw new Error(`origin flap toggle failed: ${resp.status}`);
  const data = (await resp.json()) as { flap: boolean };
  return data.flap;
}
