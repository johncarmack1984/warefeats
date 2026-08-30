import { Link } from "react-router";
import { useCatalog } from "../catalog-context";

export function About() {
  const { state } = useCatalog();
  const latest = state.status === "ready" ? [...state.catalog.benchmarks].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] : undefined;
  const rig = latest?.environment;

  return (
    <article className="prose">
      <header className="prose-head">
        <h1>About</h1>
        <p className="deck">One person, one machine, every run published.</p>
      </header>

      <h2>Why this exists</h2>
      <p>Most tool comparisons are written by someone selling one of the tools. The rest quote a number with no machine, no versions, and no workload behind it. I wanted the page <a href="https://barefeats.com" target="_blank" rel="noreferrer">barefeats</a> used to publish for Mac hardware, but for the choices I actually have to make at work: the linter, the bundler, the cache, the desktop shell, the map renderer, the tile server.</p>

      <h2>Who runs it</h2>
      <p>I'm John Carmack. I write Rust and TypeScript for a living. I run every benchmark here myself, on my own hardware, with a runner you can read. No sponsor. No affiliation with any tool on this site.</p>

      <h2>The rig</h2>
      {rig ? (
        <p>Every published run so far came off one machine: {rig.machine}, {rig.chip}, {rig.cores}, {rig.memory}, {rig.os} on {rig.arch}, {rig.runtime}. When that changes, the result page says so. Numbers from different machines never share a page.</p>
      ) : (
        <p>Every result page names the exact machine it ran on. Numbers from different machines never share a page.</p>
      )}

      <h2>Independence</h2>
      <p>Hosting comes out of my pocket, and later out of ads. If a sponsor ever pays for a bigger rig, that sponsor gets named on every result that ran on it. Nobody but me picks what gets benchmarked or how.</p>

      <h2>Logos</h2>
      <p>Product logos appear unmodified to identify the products under test and imply no endorsement. Varnish is a registered trademark of Varnish Software AB. NGINX is a trademark of F5, Inc. The Vinyl Cache logo is CC BY 4.0 <a href="https://rhubarbe.design" target="_blank" rel="noreferrer">Rhubarbe.design</a>. ESLint and Biome logos belong to their respective projects.</p>

      <h2>Corrections</h2>
      <p>Think a result is wrong? Open an issue in the <a href="https://github.com/johncarmack1984/warefeats" target="_blank" rel="noreferrer">repository</a> with your rig and your samples. Corrections go up as new runs. The original stays, with a note.</p>

      <p className="prose-foot"><Link to="/methodology">How each run is done</Link></p>
    </article>
  );
}
