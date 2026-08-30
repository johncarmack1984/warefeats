import { Link } from "react-router";

export function Methodology() {
  return (
    <article className="prose">
      <header className="prose-head">
        <h1>Methodology</h1>
        <p className="deck">What every run holds still, so a number on one page means the same thing on the next.</p>
      </header>

      <h2>Pinned versions</h2>
      <p>Every candidate is installed at an exact version in the runner's workspace, and that version is printed on the result. Nothing floats. When a release changes the picture, I run it again and publish a new entry. I don't edit the old one.</p>

      <h2>One corpus, held still</h2>
      <p>Both tools get the same files in the same order. The corpus is named on every result with its file count, line count, and size, and you can fetch it yourself: a published package's source, a public repo at a pinned commit, or a generated workload with the generator in the repository.</p>

      <h2>Warm, then fork</h2>
      <p>Each candidate gets unmeasured warmup passes first, so the filesystem cache is hot for everyone. Then every measured pass starts a fresh process. Startup cost counts. Nobody gets an in-process cache the other tool can't have.</p>

      <h2>Every sample is published</h2>
      <p>A result is not one number. The report shows the mean with its standard deviation, the range, and the median. Figure 1 plots every pass on one shared axis, so the gap between tools is something you can see, not something I summarized. The ratio in the summary is the slower mean over the faster mean, with the uncertainty propagated the way <a href="https://github.com/sharkdp/hyperfine" target="_blank" rel="noreferrer">hyperfine</a> does it.</p>

      <h2>The rig is named</h2>
      <p>Machine, chip, cores, memory, OS, runtime: printed next to every result. Numbers from different rigs never share a page.</p>

      <h2>Limits are stated</h2>
      <p>Each page ends with what the run does not prove. Lint throughput says nothing about rule coverage, editor integration, or migration cost, and the page says so.</p>

      <h2>Reproduce it</h2>
      <p>The runner for every published benchmark is in the <a href="https://github.com/warefeats/warefeats.com" target="_blank" rel="noreferrer">warefeats repository</a>, next to the catalog this site renders. Run it on your machine. If your numbers disagree with mine, open an issue with your rig and your samples.</p>

      <p className="prose-foot"><Link to="/">Back to the benchmarks</Link></p>
    </article>
  );
}
