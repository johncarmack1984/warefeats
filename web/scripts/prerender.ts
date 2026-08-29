import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCatalog } from "../src/catalog";
import type { BenchmarkCatalog } from "../src/types";

interface ServerEntry {
  render: (path: string, catalog: BenchmarkCatalog) => { html: string; head: string };
  prerenderPaths: (catalog: BenchmarkCatalog) => string[];
}

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const template = await readFile(join(dist, "index.html"), "utf8");
const catalog = parseCatalog(JSON.parse(await readFile(join(root, "public", "data", "benchmarks.json"), "utf8")));
const entry = (await import(pathToFileURL(join(dist, "server", "entry-server.js")).href)) as ServerEntry;

const embedded = JSON.stringify(catalog).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const dataTag = `<script id="wf-catalog" type="application/json">${embedded}</script>`;

for (const placeholder of ["<!--app-head-->", "<!--app-html-->", "<!--app-data-->", 'data-path=""']) {
  if (!template.includes(placeholder)) {
    throw new Error(`dist/index.html is missing the ${placeholder} placeholder.`);
  }
}

const paths = entry.prerenderPaths(catalog);

for (const path of paths) {
  const { html, head } = entry.render(path, catalog);
  const page = template
    .replace("<!--app-head-->", head)
    .replace('data-path=""', `data-path="${path}"`)
    .replace("<!--app-html-->", html)
    .replace("<!--app-data-->", dataTag);
  const file = path === "/" ? join(dist, "index.html") : join(dist, path.replace(/^\/|\/$/g, ""), "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page);
}

await rm(join(dist, "server"), { recursive: true, force: true });
console.log(`Prerendered ${paths.length} pages: ${paths.join(", ")}`);
