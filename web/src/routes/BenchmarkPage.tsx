import { DownloadSimple } from "@phosphor-icons/react";
import { Link, useParams } from "react-router";
import { useCatalog } from "../catalog-context";
import { BarChart } from "../components/BarChart";
import { Conditions } from "../components/Conditions";
import { Products } from "../components/Products";
import { CopyReport } from "../components/CopyReport";
import { ReportBlock } from "../components/ReportBlock";
import { BoxPlot } from "../components/BoxPlot";
import { CatalogSkeleton, ErrorState } from "../components/States";
import { benchmarkTests, formatDate } from "../metrics";
import { NotFound } from "./NotFound";

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

  const tests = benchmarkTests(benchmark);
  const ruleColumns = benchmark.ruleMap.length ? Object.keys(benchmark.ruleMap[0]!).filter((key) => key !== "intent") : [];
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
                  {benchmark.ruleMap.map((rule) => (
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
        <p className="limits-foot">Rerun it yourself: the runner and this corpus definition are in the <a href="https://github.com/johncarmack1984/warefeats" target="_blank" rel="noreferrer">repository</a>, and the <Link to="/methodology">methodology</Link> page covers what every run holds constant. Think a result is wrong? Open an issue with your rig and your samples.</p>
      </section>
    </article>
  );
}
