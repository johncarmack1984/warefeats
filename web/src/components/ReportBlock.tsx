import { formatDuration, standardDeviation } from "../metrics";
import type { Benchmark, Candidate } from "../types";

interface ReportBlockProps {
  benchmark: Benchmark;
  candidate: Candidate;
  index: number;
}

/** One candidate's block, in the shape hyperfine prints it. */
export function ReportBlock({ benchmark, candidate, index }: ReportBlockProps) {
  const sigma = standardDeviation(candidate.samplesMs);
  const isWinner = candidate.id === benchmark.verdict.winnerId;

  return (
    <section className={isWinner ? "report-block is-fastest" : "report-block"} aria-labelledby={`report-${candidate.id}`}>
      <h3 id={`report-${candidate.id}`} className="report-title">
        <span className="report-index">Benchmark {index + 1}:</span> {candidate.name} <span className="report-version">{candidate.version}</span>
        {isWinner ? <span className="report-flag">fastest</span> : null}
      </h3>
      <dl className="report-lines">
        <div>
          <dt>Time (mean ± σ)</dt>
          <dd><span className="num">{formatDuration(candidate.statistics.meanMs)}</span> ± <span className="num">{formatDuration(sigma)}</span></dd>
        </div>
        <div>
          <dt>Range (min … max)</dt>
          <dd><span className="num">{formatDuration(candidate.statistics.minMs)}</span> … <span className="num">{formatDuration(candidate.statistics.maxMs)}</span></dd>
        </div>
        <div>
          <dt>Median</dt>
          <dd><span className="num">{formatDuration(candidate.statistics.medianMs)}</span> <span className="report-runs">{candidate.samplesMs.length} runs</span></dd>
        </div>
      </dl>
    </section>
  );
}
