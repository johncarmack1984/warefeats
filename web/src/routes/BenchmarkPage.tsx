import { DownloadSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useCatalog } from "../catalog-context";
import { BarChart } from "../components/BarChart";
import { Conditions } from "../components/Conditions";
import { Products } from "../components/Products";
import { CopyReport } from "../components/CopyReport";
import { ReportBlock } from "../components/ReportBlock";
import { REPO_URL } from "../components/SiteHeader";
import { BoxPlot } from "../components/BoxPlot";
import { CatalogSkeleton, ErrorState } from "../components/States";
import { benchmarkTests, formatDate, formatValue, scorecard } from "../metrics";
import type { Benchmark } from "../types";
import { NotFound } from "./NotFound";

const BASE_RUN_ID = "__base";

function EnvironmentToggle({ options, selected, onSelect }: { options: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="env-toggle" aria-label="Test environment">
      {options.map((option) => (
        <button key={option.id} aria-pressed={option.id === selected} className={`env-toggle-btn${option.id === selected ? " active" : ""}`} onClick={() => onSelect(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function useActiveRun(benchmark: Benchmark) {
  const runs = benchmark.runs ?? [];
  const hasRuns = runs.length > 0;
  const [selectedId, setSelectedId] = useState(BASE_RUN_ID);
  const activeRun = selectedId !== BASE_RUN_ID ? runs.find((r) => r.id === selectedId) : undefined;
  const toggleOptions = hasRuns ? [{ id: BASE_RUN_ID, label: benchmark.environment.machine }, ...runs] : [];
  return {
    hasRuns,
    selectedId,
    setSelectedId,
    toggleOptions,
    environment: activeRun?.environment ?? benchmark.environment,
    protocol: activeRun?.protocol ?? benchmark.protocol,
    sections: activeRun?.sections ?? benchmark.sections,
    candidates: activeRun?.candidates ?? benchmark.candidates,
  };
}

/** The verdict's numbers as a table: one row per candidate, one column per section, medians. */
function Scorecard({ sections }: { sections: Benchmark["sections"] }) {
  if (!sections?.length) return null;
  const card = scorecard(sections);
  return (
    <div className="table-scroll scorecard">
      <table>
        <caption>Median of each section's samples per candidate. The section winner is marked in red.</caption>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            {card.columns.map((column) => (
              <th scope="col" key={column.id}>
                {column.title} <span className="unit">({column.unit}, {column.lowerIsBetter ? "lower is better" : "higher is better"})</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((row) => (
            <tr key={row.candidateId}>
              <th scope="row">{row.name}</th>
              {row.cells.map((cell, index) => {
                const column = card.columns[index]!;
                const winner = column.winnerId === row.candidateId;
                return (
                  <td className={`num${winner ? " scorecard-winner" : ""}`} key={column.id}>
                    {cell === null ? <span aria-label="not run">–</span> : formatValue(cell, column.unit)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarkContent({ benchmark }: { benchmark: Benchmark }) {
  const run = useActiveRun(benchmark);

  if ((run.sections ?? benchmark.sections)?.length) {
    const displaySections = run.sections ?? benchmark.sections ?? [];
    return (
      <article className="benchmark">
        <header className="benchmark-head">
          <p className="crumbs"><Link to="/">Benchmarks</Link> <span aria-hidden="true">/</span> {benchmark.category}</p>
          <h1>{benchmark.title}</h1>
          <p className="deck">{benchmark.deck}</p>
          <p className="byline">Published <time dateTime={benchmark.publishedAt} className="num">{formatDate(benchmark.publishedAt)}</time> on {run.environment.machine}, {run.environment.chip}</p>
        </header>

        {run.hasRuns && <EnvironmentToggle options={run.toggleOptions} selected={run.selectedId} onSelect={run.setSelectedId} />}

        {displaySections.map((section) => {
          const sectionTests = section.tests ?? [];
          return (
            <section className="benchmark-section" key={section.id} aria-labelledby={`section-${section.id}`}>
              <h2 id={`section-${section.id}`}>{section.title}</h2>
              <p className="deck">{section.deck}</p>
              {sectionTests.length ? (
                <div className="test-grid">
                  {sectionTests.map((test, index) => (
                    <BarChart benchmark={{ ...benchmark, candidates: section.candidates }} test={test} index={index} key={test.id} />
                  ))}
                </div>
              ) : null}
              <p className="section-verdict">{section.verdict.headline}</p>
            </section>
          );
        })}

        <Conditions benchmark={{ ...benchmark, environment: run.environment, protocol: run.protocol }} />

        <section className="learned" aria-labelledby="learned-title">
          <h2 id="learned-title">What did we learn?</h2>
          <p className="learned-lead">{benchmark.verdict.headline}.</p>
          <Scorecard sections={displaySections} />
          <p className="learned-summary">{benchmark.verdict.summary}</p>
          <h3>What this does not prove</h3>
          <ul>
            {benchmark.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
          <p className="limits-foot">Rerun it yourself: the runner and configuration are in the <a href={benchmark.runnerUrl ?? REPO_URL} target="_blank" rel="noreferrer">repository</a>, and the <Link to="/methodology">methodology</Link> page covers what every run holds constant. Think a result is wrong? Open an issue with your rig and your samples.</p>
          {benchmark.trademarks ? <p className="limits-foot">{benchmark.trademarks.join(" ")}</p> : null}
        </section>
      </article>
    );
  }

  const tests = benchmarkTests(benchmark);
  const ruleColumns = benchmark.ruleMap?.length ? Object.keys(benchmark.ruleMap[0]!).filter((key) => key !== "intent") : [];
  const candidateName = (id: string): string => benchmark.candidates.find((candidate) => candidate.id === id)?.name ?? id;

  return (
    <article className="benchmark">
      <header className="benchmark-head">
        <p className="crumbs"><Link to="/">Benchmarks</Link> <span aria-hidden="true">/</span> {benchmark.category}</p>
        <h1>{benchmark.title}</h1>
        <p className="deck">{benchmark.deck}</p>
        <p className="byline">Published <time dateTime={benchmark.publishedAt} className="num">{formatDate(benchmark.publishedAt)}</time> on {benchmark.environment.machine}, {benchmark.environment.chip}</p>
      </header>

      <Products benchmark={benchmark} />

      <section className="tests" aria-labelledby="tests-title">
        <h2 id="tests-title">Tests</h2>
        {tests.length ? (
          <div className="test-grid">
            {tests.map((test, index) => (
              <BarChart benchmark={benchmark} test={test} index={index} key={test.id} />
            ))}
          </div>
        ) : (
          <div className="test-single">
            <BoxPlot benchmark={benchmark} index={0} />
          </div>
        )}
        <details className="report-details">
          <summary>Full report, as hyperfine prints it</summary>
          <div className="report-grid">
            {benchmark.candidates.map((candidate, index) => (
              <ReportBlock benchmark={benchmark} candidate={candidate} index={index} key={candidate.id} />
            ))}
          </div>
          <div className="report-actions">
            <CopyReport benchmark={benchmark} />
            <a className="button button-quiet" href="/data/benchmarks.json" download>
              <DownloadSimple aria-hidden="true" />
              Raw catalog JSON
            </a>
          </div>
        </details>
        {ruleColumns.length ? (
          <details className="report-details rules">
            <summary>Matched rule intent</summary>
            <p>Each row is one intent both tools enforce. The implementations differ; the intent is what was held equal.</p>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Rule pairs by intent</caption>
                <thead>
                  <tr>
                    <th scope="col">Intent</th>
                    {ruleColumns.map((column) => <th scope="col" key={column}>{candidateName(column)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {benchmark.ruleMap?.map((rule) => (
                    <tr key={rule.intent}>
                      <th scope="row">{rule.intent}</th>
                      {ruleColumns.map((column) => <td key={column}><code>{rule[column]}</code></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
        <Conditions benchmark={benchmark} />
      </section>

      <section className="learned" aria-labelledby="learned-title">
        <h2 id="learned-title">What did we learn?</h2>
        <p className="learned-lead">{benchmark.verdict.headline}. {benchmark.verdict.summary}</p>
        <h3>What this does not prove</h3>
        <ul>
          {benchmark.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
        <p className="limits-foot">Rerun it yourself: the runner and this corpus definition are in the <a href={benchmark.runnerUrl ?? REPO_URL} target="_blank" rel="noreferrer">repository</a>, and the <Link to="/methodology">methodology</Link> page covers what every run holds constant. Think a result is wrong? Open an issue with your rig and your samples.</p>
        {benchmark.trademarks ? <p className="limits-foot">{benchmark.trademarks.join(" ")}</p> : null}
      </section>
    </article>
  );
}

export function BenchmarkPage() {
  const { slug } = useParams();
  const { state, reload } = useCatalog();

  if (state.status === "loading") {
    return <CatalogSkeleton />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={reload} />;
  }

  const benchmark = state.catalog.benchmarks.find((entry) => entry.slug === slug);

  if (!benchmark) {
    return <NotFound />;
  }

  return <BenchmarkContent benchmark={benchmark} />;
}
