import { formatBytes, formatInteger } from "../metrics";
import type { Benchmark } from "../types";

interface ConditionsProps {
  benchmark: Benchmark;
}

/** The rig, the corpus, and the protocol, one disclosure under the chart; the byline keeps the rig on the page. */
export function Conditions({ benchmark }: ConditionsProps) {
  const { environment, corpus, protocol } = benchmark;

  return (
    <details className="report-details conditions">
      <summary>Test conditions: rig, corpus, protocol</summary>
      <div className="conditions-grid">
        <dl className="kv">
          <div className="kv-group">Rig</div>
          <div><dt>Machine</dt><dd>{environment.machine}</dd></div>
          <div><dt>Chip</dt><dd>{environment.chip}</dd></div>
          <div><dt>Cores</dt><dd>{environment.cores}</dd></div>
          <div><dt>Memory</dt><dd>{environment.memory}</dd></div>
          <div><dt>OS</dt><dd>{environment.os} ({environment.arch})</dd></div>
          <div><dt>Runtime</dt><dd>{environment.runtime}</dd></div>
          {environment.gpu ? <div><dt>GPU</dt><dd>{environment.gpu}</dd></div> : null}
          {environment.browser ? <div><dt>Browser</dt><dd>{environment.browser}</dd></div> : null}
          {environment.display ? <div><dt>Display</dt><dd>{environment.display}</dd></div> : null}
        </dl>
        {corpus ? (
          <dl className="kv">
            <div className="kv-group">Corpus</div>
            <div><dt>Name</dt><dd>{corpus.name}</dd></div>
            <div><dt>Source</dt><dd><code>{corpus.source}</code></dd></div>
            <div><dt>Files</dt><dd className="num">{formatInteger(corpus.files)}</dd></div>
            <div><dt>Lines</dt><dd className="num">{formatInteger(corpus.lines)}</dd></div>
            <div><dt>Size</dt><dd className="num">{formatBytes(corpus.bytes)}</dd></div>
          </dl>
        ) : null}
        <dl className="kv">
          <div className="kv-group">Protocol</div>
          <div><dt>Warmups</dt><dd className="num">{protocol.warmups} unmeasured passes</dd></div>
          <div><dt>Measured</dt><dd className="num">{protocol.runs} passes per tool</dd></div>
          <div><dt>Process</dt><dd>{protocol.processModel}</dd></div>
          <div><dt>Cache</dt><dd>{protocol.cacheState}</dd></div>
          <div><dt>Output</dt><dd>{protocol.output}</dd></div>
        </dl>
      </div>
    </details>
  );
}
