import { Link } from "react-router";
import { useCatalog } from "../catalog-context";
import { Queue } from "../components/Queue";
import { CatalogSkeleton, EmptyState, ErrorState } from "../components/States";
import { benchmarkPath } from "../head";
import { formatDate, formatRatio, summarize } from "../metrics";
import type { Benchmark } from "../types";

function groupByCategory(benchmarks: Benchmark[]): Array<[string, Benchmark[]]> {
  const groups = new Map<string, Benchmark[]>();
  const sorted = [...benchmarks].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  for (const benchmark of sorted) {
    const group = groups.get(benchmark.category) ?? [];
    group.push(benchmark);
    groups.set(benchmark.category, group);
  }

  return [...groups.entries()];
}

export function Home() {
  const { state, reload } = useCatalog();

  return (
    <>
      <section className="intro" aria-labelledby="intro-title">
        <h1 id="intro-title">Benchmarks for developer tools, with the runs attached.</h1>
        <p>I pin the versions, hold the corpus still, warm the cache, and fork a fresh process for every pass. You get the number, the machine it came from, and every sample behind it.</p>
      </section>

      {state.status === "loading" ? <CatalogSkeleton /> : null}
      {state.status === "error" ? <ErrorState message={state.message} onRetry={reload} /> : null}
      {state.status === "ready" && state.catalog.benchmarks.length === 0 ? <EmptyState /> : null}

      {state.status === "ready" && state.catalog.benchmarks.length > 0 ? (
        <section className="index" aria-labelledby="index-title">
          <div className="section-head">
            <h2 id="index-title">Published</h2>
            <p>Newest first inside each category. The ratio is the mean of the fastest tool against the slower one, with its propagated σ.</p>
          </div>
          {groupByCategory(state.catalog.benchmarks).map(([category, benchmarks]) => (
            <div className="index-group" key={category}>
              <h3 className="index-category">{category}</h3>
              <ol className="index-list">
                {benchmarks.map((benchmark) => {
                  const summary = summarize(benchmark);
                  const lead = summary.comparisons[0];

                  return (
                    <li className="index-row" key={benchmark.id}>
                      <span className="index-date num">{formatDate(benchmark.publishedAt)}</span>
                      <Link className="index-title" to={benchmarkPath(benchmark.slug)}>{benchmark.title}</Link>
                      <span className="index-summary">
                        {lead ? (
                          <>
                            <strong>{summary.winner.name}</strong> ran <span className="num">{formatRatio(lead)}</span> times faster than {lead.other.name}
                          </>
                        ) : (
                          benchmark.verdict.headline
                        )}
                      </span>
                      <span className="index-rig">{benchmark.environment.chip} · <span className="num">{benchmark.protocol.runs}</span> runs</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      ) : null}

      {state.status === "ready" ? <Queue items={state.catalog.queue} /> : null}
    </>
  );
}
