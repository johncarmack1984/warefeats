import { useId } from "react";
import type { KeyboardEvent } from "react";
import { axisTicks, fiveNumber, formatDuration, samplePosition } from "../metrics";
import type { Benchmark } from "../types";

interface BoxPlotProps {
  benchmark: Benchmark;
  index: number;
}

function stepThroughRuns(event: KeyboardEvent<HTMLDivElement>): void {
  const marks = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".plot-mark"));
  if (!marks.length) {
    return;
  }

  const current = marks.indexOf(document.activeElement as HTMLElement);
  let next: number | undefined;

  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = current < 0 ? 0 : Math.min(current + 1, marks.length - 1);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = current < 0 ? marks.length - 1 : Math.max(current - 1, 0);
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = marks.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  marks[next]?.focus();
}

/**
 * One box plot of time per pass for every candidate on a shared axis: the box is the middle half
 * of the runs, the line is the median, the whiskers reach the fastest and slowest pass, and every
 * run is a dot. The fastest candidate is red, the rest ink. Each track is one tab stop; arrow keys
 * step through its runs.
 */
export function BoxPlot({ benchmark, index }: BoxPlotProps) {
  const id = useId();
  // The axis starts at zero, like a bar chart, and ends one friendly step past the slowest pass.
  const slowest = Math.max(...benchmark.candidates.flatMap((candidate) => candidate.samplesMs));
  const probe = axisTicks(0, slowest * 1.15, 5);
  const step = probe.length > 1 ? probe[1]! - probe[0]! : slowest || 1;
  const range = { min: 0, max: Math.ceil((slowest * 1.08) / step) * step };
  const ticks = axisTicks(0, range.max, 6).filter((tick) => tick <= range.max);
  const runs = benchmark.protocol.runs;
  const direction = benchmark.lowerIsBetter ? "LOWER" : "HIGHER";
  const pos = (value: number) => samplePosition(value, range.min, range.max);

  return (
    <section className="test" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="test-title">
        <span className="test-index">Test {index + 1}</span> Time per pass
      </h3>
      <p className="test-description">
        {runs} measured passes over the corpus. Box is the middle half of the runs, line is the median, whiskers reach the fastest and slowest pass, dots are every run. <span className="test-direction">({direction} {benchmark.unit} = {benchmark.lowerIsBetter ? "FASTER" : "BETTER"})</span>
      </p>

      <figure className="bar-chart box-plot" aria-labelledby={`${id}-title`}>
        <figcaption className="bar-chart-head">Time per pass ({benchmark.unit})</figcaption>
        <div className="box-rows">
          {benchmark.candidates.map((candidate) => {
            const isWinner = candidate.id === benchmark.verdict.winnerId;
            const five = fiveNumber(candidate.samplesMs);

            return (
              <div
                className={isWinner ? "box-row is-fastest" : "box-row"}
                style={candidate.color ? ({ "--brand": candidate.color } as React.CSSProperties) : undefined}
                key={candidate.id}
              >
                <span className="bar-label">
                  {candidate.logo ? <img src={candidate.logo} alt="" height="24" /> : null}
                  <span>{candidate.name}</span>
                </span>
                <div
                  className="plot-track box-track"
                  role="list"
                  tabIndex={0}
                  aria-label={`${candidate.name}: median ${formatDuration(five.median)}, middle half ${formatDuration(five.q1)} to ${formatDuration(five.q3)}, range ${formatDuration(five.min)} to ${formatDuration(five.max)}. Use the arrow keys to step through runs.`}
                  onKeyDown={stepThroughRuns}
                >
                  <span className="box-fill" style={{ width: `${pos(five.median)}%` }} aria-hidden="true" />
                  <span className="box-whisker" style={{ left: `${pos(five.min)}%`, width: `${pos(five.max) - pos(five.min)}%` }} aria-hidden="true" />
                  <span className="box-cap" style={{ left: `${pos(five.min)}%` }} aria-hidden="true" />
                  <span className="box-cap" style={{ left: `${pos(five.max)}%` }} aria-hidden="true" />
                  <span className="box-iqr" style={{ left: `${pos(five.q1)}%`, width: `${pos(five.q3) - pos(five.q1)}%` }} aria-hidden="true" />
                  <span className="plot-median box-median" style={{ left: `${pos(five.median)}%` }} aria-hidden="true" />
                  {candidate.samplesMs.map((sample, runIndex) => {
                    const position = pos(sample);
                    const edge = position > 82 ? " is-right" : position < 12 ? " is-left" : "";
                    return (
                      <span
                        className={`plot-mark box-mark${edge}`}
                        role="listitem"
                        tabIndex={-1}
                        data-label={`Run ${runIndex + 1}: ${formatDuration(sample)}`}
                        aria-label={`Run ${runIndex + 1}: ${formatDuration(sample)}`}
                        style={{ left: `${position}%`, "--lane": runIndex % 3 } as React.CSSProperties}
                        key={`${candidate.id}-${runIndex}`}
                      />
                    );
                  })}
                  <span className="box-value num" style={{ left: `${pos(five.max)}%` }} aria-hidden="true">{formatDuration(five.median)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bar-axis box-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span className="bar-tick num" style={{ left: `${pos(tick)}%` }} key={tick}>
              {Number.isInteger(tick) ? `${tick} ${benchmark.unit}` : formatDuration(tick)}
            </span>
          ))}
        </div>
      </figure>

      <details className="sample-table">
        <summary>All {runs} samples as a table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Run</th>
                {benchmark.candidates.map((candidate) => <th scope="col" key={candidate.id}>{candidate.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: runs }, (_, runIndex) => (
                <tr key={runIndex}>
                  <th scope="row" className="num">{runIndex + 1}</th>
                  {benchmark.candidates.map((candidate) => (
                    <td className="num" key={candidate.id}>{candidate.samplesMs[runIndex] === undefined ? "" : formatDuration(candidate.samplesMs[runIndex])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
