import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import { BenchmarkFeature } from "./components/BenchmarkFeature";
import { Hero } from "./components/Hero";
import { Methodology } from "./components/Methodology";
import { Queue } from "./components/Queue";
import { SiteHeader } from "./components/SiteHeader";
import { BenchmarkSkeleton, EmptyState, ErrorState } from "./components/States";
import { useCatalog } from "./hooks/useCatalog";

export default function App() {
  const { state, reload } = useCatalog();
  const featured = state.status === "ready" ? state.catalog.benchmarks[0] : undefined;

  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Hero featured={featured} />
        {state.status === "loading" ? <BenchmarkSkeleton /> : null}
        {state.status === "error" ? <ErrorState message={state.message} onRetry={reload} /> : null}
        {state.status === "ready" && !featured ? <EmptyState /> : null}
        {state.status === "ready" && featured ? (
          <>
            <BenchmarkFeature benchmark={featured} />
            <Methodology benchmark={featured} />
            <Queue items={state.catalog.queue} />
          </>
        ) : null}
      </main>
      <footer className="site-footer">
        <div>
          <span className="wordmark footer-wordmark"><span className="wordmark-mark" aria-hidden="true">wf</span><span>warefeats</span></span>
          <p>Benchmarks for technology decisions. Raw runs included.</p>
        </div>
        <a href="https://github.com/johncarmack1984/warefeats" target="_blank" rel="noreferrer">
          <GithubLogo aria-hidden="true" />
          Source and runner
          <ArrowUpRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
