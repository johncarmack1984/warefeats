import satori from "satori";
import type { SatoriOptions } from "satori";
import { formatDate, formatRatio, summarize } from "./metrics";
import type { Benchmark } from "./types";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/* barefeats.com's three colors; the card is always the printed (light) version. */
const PAPER = "#ffffff";
const INK = "#000000";
const RED = "#cc0000";
const MUTED = "#555555";

export interface OgFonts {
  mono500: ArrayBuffer;
  mono700: ArrayBuffer;
  sans500: ArrayBuffer;
}

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Array<Node | string> | string };
}

/** Satori element without JSX, so the same module runs from the build script, the tests, and the Vite config. */
function h(type: string, style: Style, ...children: Array<Node | string>): Node {
  return { type, props: { style, children: children.length === 1 && typeof children[0] === "string" ? children[0] : children } };
}

function options(fonts: OgFonts): SatoriOptions {
  return {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: "Martian Mono", data: fonts.mono500, weight: 500, style: "normal" },
      { name: "Martian Mono", data: fonts.mono700, weight: 700, style: "normal" },
      { name: "Red Hat Text", data: fonts.sans500, weight: 500, style: "normal" },
    ],
  };
}

const mono = "Martian Mono";
const sans = "Red Hat Text";
const row = (style: Style) => ({ display: "flex", ...style });
const column = (style: Style = {}) => ({ display: "flex", flexDirection: "column", ...style });

function frame(foot: string, ...body: Node[]): Node {
  return h(
    "div",
    { ...column({ justifyContent: "space-between" }), width: "100%", height: "100%", padding: "56px 64px", background: PAPER, color: INK },
    h(
      "div",
      row({ alignItems: "baseline", fontFamily: mono, fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }),
      h("span", { color: RED, marginRight: 14 }, "$"),
      h("span", {}, "warefeats"),
    ),
    h("div", column(), ...body),
    h("div", row({ fontFamily: mono, fontSize: 22, fontWeight: 500, color: MUTED }), foot),
  );
}

/** The benchmark card: the hyperfine summary line with the ratio at display scale. */
export async function benchmarkCard(benchmark: Benchmark, fonts: OgFonts): Promise<string> {
  const summary = summarize(benchmark);
  const lead = summary.comparisons[0];
  const foot = `${benchmark.environment.machine} · ${benchmark.environment.chip} · ${benchmark.protocol.runs} runs · ${formatDate(benchmark.publishedAt)}`;
  const title = h("div", row({ fontFamily: sans, fontSize: 30, fontWeight: 500, color: MUTED, marginBottom: 18 }), benchmark.title);
  const body = lead
    ? h(
        "div",
        column(),
        h("div", row({ fontFamily: mono, fontSize: 38, fontWeight: 500 }), `${summary.winner.name} ${summary.winner.version} ran`),
        h("div", row({ fontFamily: mono, fontSize: 120, fontWeight: 700, color: RED, letterSpacing: -5, lineHeight: 1.15, marginLeft: -4, whiteSpace: "nowrap" }), formatRatio(lead)),
        h("div", row({ fontFamily: mono, fontSize: 38, fontWeight: 500 }), `times faster than ${lead.other.name} ${lead.other.version}`),
      )
    : h("div", row({ fontFamily: mono, fontSize: 64, fontWeight: 700, color: RED }), benchmark.verdict.headline);

  return satori(frame(foot, title, body) as unknown as React.ReactNode, options(fonts));
}

/** The site card for the home and prose pages. */
export async function siteCard(fonts: OgFonts): Promise<string> {
  return satori(
    frame(
      "warefeats.com",
      h("div", row({ fontFamily: sans, fontSize: 72, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 980 }), "Benchmarks for developer tools, with the runs attached."),
      h("div", row({ fontFamily: mono, fontSize: 30, fontWeight: 500, color: RED, marginTop: 36 }), "every run published · every rig named"),
    ) as unknown as React.ReactNode,
    options(fonts),
  );
}
