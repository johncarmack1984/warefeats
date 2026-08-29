const ORIGIN_LATENCY_MS = Number(process.env.ORIGIN_LATENCY_MS ?? 0);
const MANIFEST_LINES = 200;

let flapActive = false;
const requestCounts = new Map<string, number>();

function generateManifest(): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:6",
    "#EXT-X-MEDIA-SEQUENCE:0",
  ];
  for (let i = 0; i < MANIFEST_LINES; i++) {
    lines.push(`#EXTINF:6.000,`, `segment-${i}.ts`);
  }
  lines.push("#EXT-X-ENDLIST");
  return lines.join("\n") + "\n";
}

const MANIFEST_BODY = generateManifest();
const MANIFEST_BYTES = Buffer.from(MANIFEST_BODY);
const MANIFEST_ETAG = `"manifest-${MANIFEST_BYTES.length}"`;
const MANIFEST_LAST_MODIFIED = new Date("2026-01-01T00:00:00Z").toUTCString();

const SEGMENT_SIZE = 4 * 1024 * 1024;
const segmentCache = new Map<string, Buffer>();

function getSegment(name: string): Buffer {
  let buf = segmentCache.get(name);
  if (buf) return buf;
  buf = Buffer.alloc(SEGMENT_SIZE);
  const seed = Array.from(name).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  for (let i = 0; i < SEGMENT_SIZE; i += 4) {
    buf.writeUInt32LE(((seed + i) * 2654435761) >>> 0, i);
  }
  segmentCache.set(name, buf);
  return buf;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

function parseRange(header: string, size: number): [number, number] | null {
  const m = header.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  if (start > end || start >= size) return null;
  return [start, Math.min(end, size - 1)];
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "POST" && path === "/_control/flap") {
      flapActive = !flapActive;
      return new Response(JSON.stringify({ flap: flapActive }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/_stats/requests") {
      const filterPath = url.searchParams.get("path");
      if (filterPath) {
        return new Response(
          JSON.stringify({ path: filterPath, count: requestCounts.get(filterPath) ?? 0 }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      const all = Object.fromEntries(requestCounts);
      return new Response(JSON.stringify(all), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "/_stats/reset") {
      requestCounts.clear();
      return new Response("ok");
    }

    if (path === "/_health") {
      return new Response("ok");
    }

    requestCounts.set(path, (requestCounts.get(path) ?? 0) + 1);

    await delay(ORIGIN_LATENCY_MS);

    if (flapActive) {
      return new Response("origin flap active", { status: 500 });
    }

    if (path === "/stream/master.m3u8") {
      const inm = req.headers.get("If-None-Match");
      if (inm === MANIFEST_ETAG) {
        return new Response(null, { status: 304 });
      }
      return new Response(MANIFEST_BYTES, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Content-Length": String(MANIFEST_BYTES.length),
          "ETag": MANIFEST_ETAG,
          "Last-Modified": MANIFEST_LAST_MODIFIED,
          "Cache-Control": "public, max-age=2",
        },
      });
    }

    const segMatch = path.match(/^\/stream\/(segment-\d+\.ts)$/);
    if (segMatch) {
      const segName = segMatch[1]!;
      const body = getSegment(segName);
      const etag = `"${segName}-${body.length}"`;

      const inm = req.headers.get("If-None-Match");
      if (inm === etag) {
        return new Response(null, { status: 304 });
      }

      const rangeHeader = req.headers.get("Range");
      if (rangeHeader) {
        const range = parseRange(rangeHeader, body.length);
        if (!range) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${body.length}` },
          });
        }
        const [start, end] = range;
        return new Response(body.subarray(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": "video/mp2t",
            "Content-Range": `bytes ${start}-${end}/${body.length}`,
            "Content-Length": String(end - start + 1),
            "ETag": etag,
            "Last-Modified": MANIFEST_LAST_MODIFIED,
            "Cache-Control": "public, max-age=60",
            "Accept-Ranges": "bytes",
          },
        });
      }

      return new Response(body, {
        headers: {
          "Content-Type": "video/mp2t",
          "Content-Length": String(body.length),
          "ETag": etag,
          "Last-Modified": MANIFEST_LAST_MODIFIED,
          "Cache-Control": "public, max-age=60",
          "Accept-Ranges": "bytes",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`origin listening on :${server.port}`);
