import { axisTicks, formatValue, samplePosition, testWinner } from "../metrics";
import type { Benchmark, BenchmarkTest } from "../types";

interface BarChartProps {
  benchmark: Benchmark;
  test: BenchmarkTest;
  index: number;
}

/**
 * One barefeats-style test: a boxed chart with the title in its header band, one horizontal bar
 * per product from a zero baseline, the value at the end of each bar, and ticks along the bottom.
 * The better bar is red; the rest are ink.
 */
export function BarChart({ benchmark, test, index }: BarChartProps) {
  const winner = testWinner(test);
  const max = Math.max(...test.results.map((result) => result.value));
  // The axis runs from zero to one friendly step past the largest value, so no bar touches the edge.
  const probe = axisTicks(0, max * 1.15, 5);
  const step = probe.length > 1 ? probe[1]! - probe[0]! : max || 1;
  const scaleMax = Math.ceil((max * 1.08) / step) * step;
  const ticks = axisTicks(0, scaleMax, 6).filter((tick) => tick <= scaleMax);
  const name = (id: string) => benchmark.candidates.find((candidate) => candidate.id === id)?.name ?? id;
  const direction = test.lowerIsBetter ? "LOWER" : "HIGHER";
  const headingId = `test-${test.id}`;

  return (
    <section className="test" aria-labelledby={headingId}>
      <h3 id={headingId} className="test-title">
        <span className="test-index">Test {index + 1}</span> {test.title}
      </h3>
      <p className="test-description">
        {test.description} <span className="test-direction">({direction} {test.unit} = {test.lowerIsBetter ? "FASTER" : "BETTER"})</span>
      </p>

      <figure className="bar-chart">
        <figcaption className="bar-chart-head">{test.title} ({test.unit})</figcaption>
        <div className="bar-rows">
          {test.results.map((result) => {
            const width = samplePosition(result.value, 0, scaleMax);
            const isWinner = result.candidateId === winner;
            const candidate = benchmark.candidates.find((entry) => entry.id === result.candidateId);
            const color = candidate?.color;

            return (
              <div
                className={isWinner ? "bar-row is-best" : "bar-row"}
                style={color ? ({ "--brand": color } as React.CSSProperties) : undefined}
                key={result.candidateId}
              >
                <span className="bar-label">
                  {candidate?.logo ? <img src={candidate.logo} alt="" height="24" /> : null}
                  <span>{name(result.candidateId)}</span>
                </span>
                <span className="bar-track">
                  <span className="bar" style={{ width: `${width}%` }} />
                  <span className="bar-value num" style={{ left: `${width}%` }}>{formatValue(result.value, test.unit)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="bar-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span className="bar-tick num" style={{ left: `${samplePosition(tick, 0, scaleMax)}%` }} key={tick}>
              {tick}
            </span>
          ))}
        </div>
        <table className="sr-only">
          <caption>{test.title} in {test.unit}</caption>
          <tbody>
            {test.results.map((result) => (
              <tr key={result.candidateId}>
                <th scope="row">{name(result.candidateId)}</th>
                <td>{formatValue(result.value, test.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </section>
  );
}
