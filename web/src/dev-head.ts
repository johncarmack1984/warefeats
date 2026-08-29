import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
import { parseCatalog } from "./catalog";
import { headTags, routeMeta } from "./head";
import type { BenchmarkCatalog } from "./types";

/**
 * Dev-server parity with the prerendered build: inject each route's head tags into the served
 * HTML and render Open Graph cards on request. Production output comes from scripts/prerender.ts
 * and scripts/og.ts; this plugin does nothing during `vite build`.
 */
export function devHead(root: string): Plugin {
  async function catalog(): Promise<BenchmarkCatalog> {
    return parseCatalog(JSON.parse(await readFile(join(root, "public", "data", "benchmarks.json"), "utf8")));
  }

  return {
    name: "warefeats-dev-head",
    apply: "serve",
    async transformIndexHtml(html, context) {
      const path = (context.originalUrl ?? context.path).replace(/^https?:\/\/[^/]+/, "");
      const meta = routeMeta(path, await catalog());
      const host = context.server?.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";
      // Point image tags at this server so link-preview tools can fetch the card before a deploy.
      const tags = host ? headTags(meta).replaceAll(`content="${meta.image}"`, `content="${meta.image.replace("https://warefeats.com", host)}"`) : headTags(meta);
      return html.replace("<!--app-head-->", tags);
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = /^\/og\/([a-z0-9-]+)\.png$/i.exec(request.url ?? "");
        if (!match) {
          next();
          return;
        }

        try {
          const [{ Resvg }, { benchmarkCard, siteCard }] = await Promise.all([import("@resvg/resvg-js"), import("./og")]);
          const font = async (name: string) => {
            const bytes = await readFile(join(root, "assets", "fonts", name));
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          };
          const fonts = { mono500: await font("MartianMono-500.ttf"), mono700: await font("MartianMono-700.ttf"), sans500: await font("RedHatText-500.ttf") };
          const benchmark = (await catalog()).benchmarks.find((entry) => entry.slug === match[1]);
          const svg = match[1] === "site" ? await siteCard(fonts) : benchmark ? await benchmarkCard(benchmark, fonts) : undefined;

          if (!svg) {
            next();
            return;
          }

          response.setHeader("Content-Type", "image/png");
          response.end(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
