import { Check, DownloadSimple, Info, Timer } from "@phosphor-icons/react";
import { useState } from "react";
import { candidateValue, formatDuration, formatInteger, samplePosition, speedup, statisticLabels } from "../metrics";
import type { Benchmark, StatisticKey } from "../types";

const statisticKeys: StatisticKey[] = ["medianMs", "meanMs", "minMs", "maxMs"];

interface BenchmarkFeatureProps {
  benchmark: Benchmark;
}

export function BenchmarkFeature({ benchmark }: BenchmarkFeatureProps) {
  const [statistic, setStatistic] = useState<StatisticKey>("medianMs");
  const values = benchmark.candidates.map((candidate) => candidateValue(candidate, statistic));
  const largest = Math.max(...values);
  const currentSpeedup = speedup(benchmark, statistic);
  const published = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(benchmark.publishedAt));

  return (
    <>
      <section className="benchmark-section" id="latest" aria-labelledby="benchmark-title">
        <header className="benchmark-heading">
          <p className="meta-line">{benchmark.category} / Published {published}</p>
          <h2 id="benchmark-title">{benchmark.title}</h2>
          <p>{benchmark.deck}</p>
        </header>

        <div className="result-layout">
          <div className="verdict-block">
            <span className="verdict-number">{currentSpeedup.toFixed(1)}x</span>
            <h3>{statisticLabels[statistic]} result</h3>
            <p>{benchmark.verdict.summary}</p>
            <div className="winner-line">
              <Check aria-hidden="true" />
              <span>{benchmark.candidates.find((candidate) => candidate.id === benchmark.verdict.winnerId)?.name} won this workload.</span>
            </div>
          </div>

          <div className="metric-panel">
            <div className="statistic-tabs" role="tablist" aria-label="Benchmark statistic">
              {statisticKeys.map((key) => (
                <button className={statistic === key ? "is-active" : undefined} type="button" role="tab" aria-selected={statistic === key} key={key} onClick={() => setStatistic(key)}>
                  {statisticLabels[key]}
                </button>
              ))}
            </div>
            <div className="bar-chart" aria-live="polite">
              {benchmark.candidates.map((candidate) => {
                const value = candidateValue(candidate, statistic);
                const scale = value / largest;
                const isWinner = candidate.id === benchmark.verdict.winnerId;

                return (
                  <div className="bar-row" key={candidate.id}>
                    <div className="bar-label">
                      <span>{candidate.name}</span>
                      <span>v{candidate.version}</span>
                    </div>
                    <div className="bar-space">
                      <div className={isWinner ? "metric-bar winner-bar" : "metric-bar"} style={{ "--bar-scale": scale } as React.CSSProperties} />
                    </div>
                    <strong>{formatDuration(value)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <dl className="test-rig">
          <div>
            <dt>Corpus</dt>
            <dd>{formatInteger(benchmark.corpus.files)} files</dd>
          </div>
          <div>
            <dt>Source lines</dt>
            <dd>{formatInteger(benchmark.corpus.lines)}</dd>
          </div>
          <div>
            <dt>Measured passes</dt>
            <dd>{benchmark.protocol.runs} per tool</dd>
          </div>
          <div>
            <dt>Test rig</dt>
            <dd>{benchmark.environment.chip}</dd>
          </div>
        </dl>
      </section>

      <section className="raw-section" aria-labelledby="raw-title">
        <div className="raw-heading">
          <Timer size={28} aria-hidden="true" />
          <h2 id="raw-title">Every measured pass</h2>
          <p>The spread matters. Each mark below is one independent CLI process after warmup.</p>
        </div>
        <div className="run-plots">
          {benchmark.candidates.map((candidate) => (
            <div className="run-plot" key={candidate.id}>
              <div className="run-plot-label">
                <span>{candidate.name}</span>
                <span>{formatDuration(candidate.statistics.minMs)} to {formatDuration(candidate.statistics.maxMs)}</span>
              </div>
              <div className="plot-line" aria-hidden="true">
                {candidate.samplesMs.map((sample, index) => (
                  <span className={candidate.id === benchmark.verdict.winnerId ? "plot-mark winner-mark" : "plot-mark"} style={{ left: `${samplePosition(sample, candidate.samplesMs)}%`, "--sample-index": index } as React.CSSProperties} key={`${candidate.id}-${index}`} />
                ))}
              </div>
              <span className="sr-only">{candidate.samplesMs.map((sample) => formatDuration(sample)).join(", ")}</span>
            </div>
          ))}
        </div>
        <div className="raw-actions">
          <a className="button button-secondary" href="/data/benchmarks.json" download>
            Download raw JSON
            <DownloadSimple aria-hidden="true" />
          </a>
          <p><Info aria-hidden="true" /> Lower is better. Speedups round down to one decimal. Plots use independent scales.</p>
        </div>
      </section>
    </>
  );
}
