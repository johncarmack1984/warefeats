import { summarize } from "./metrics";
import type { BenchmarkCatalog } from "./types";

export const SITE_NAME = "warefeats";
export const SITE_ORIGIN = "https://warefeats.com";
const DEFAULT_DESCRIPTION = "Independent, reproducible benchmarks for developer tools and architecture choices. Every result ships with its rig, protocol, and raw samples.";
const SITE_CARD = `${SITE_ORIGIN}/og/site.png`;

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  type: "website" | "article";
  publishedAt?: string;
  status: 200 | 404;
  /** Absolute URL of the Open Graph card for this route. */
  image: string;
}

export function benchmarkPath(slug: string): string {
  return `/benchmarks/${slug}/`;
}

export function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? "/";
  if (pathname === "" || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function routeMeta(path: string, catalog?: BenchmarkCatalog): RouteMeta {
  const pathname = normalizePath(path);

  if (pathname === "/") {
    return { path: pathname, title: `${SITE_NAME}: benchmarks for developer tools`, description: DEFAULT_DESCRIPTION, type: "website", status: 200, image: SITE_CARD };
  }

  if (pathname === "/methodology/") {
    return { path: pathname, title: `Methodology | ${SITE_NAME}`, description: "How every warefeats benchmark is run: pinned versions, a fixed corpus, warmups, fresh processes, and every sample published.", type: "website", status: 200, image: SITE_CARD };
  }

  if (pathname === "/about/") {
    return { path: pathname, title: `About | ${SITE_NAME}`, description: "warefeats is a one-person benchmark lab for developer tools, run on a named machine with an open-source runner.", type: "website", status: 200, image: SITE_CARD };
  }

  const match = /^\/benchmarks\/([^/]+)\/$/.exec(pathname);
  const benchmark = match ? catalog?.benchmarks.find((entry) => entry.slug === match[1]) : undefined;

  if (benchmark) {
    const summary = summarize(benchmark);
    const lead = summary.comparisons[0];
    const description = lead
      ? `${summary.winner.name} ${summary.winner.version} ran ${lead.ratio.toFixed(2)} ± ${lead.sigma.toFixed(2)} times faster than ${lead.other.name} ${lead.other.version}. ${benchmark.deck}`
      : benchmark.deck;

    return { path: pathname, title: `${benchmark.title} | ${SITE_NAME}`, description, type: "article", publishedAt: benchmark.publishedAt, status: 200, image: `${SITE_ORIGIN}/og/${benchmark.slug}.png` };
  }

  return { path: pathname, title: `Not found | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, type: "website", status: 404, image: SITE_CARD };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function headTags(meta: RouteMeta): string {
  const url = `${SITE_ORIGIN}${meta.path === "/" ? "/" : meta.path}`;
  const tags = [
    `<title>${escapeAttribute(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeAttribute(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:image" content="${meta.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${meta.image}" />`,
  ];

  if (meta.publishedAt) {
    tags.push(`<meta property="article:published_time" content="${meta.publishedAt}" />`);
  }

  if (meta.status === 404) {
    tags.push(`<meta name="robots" content="noindex" />`);
  }

  return tags.join("\n    ");
}

export function prerenderPaths(catalog: BenchmarkCatalog): string[] {
  return ["/", "/methodology/", "/about/", ...catalog.benchmarks.map((benchmark) => benchmarkPath(benchmark.slug))];
}
