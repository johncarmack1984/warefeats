import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import type { Benchmark } from "../types";

interface HeroProps {
  featured?: Benchmark;
}

export function Hero({ featured }: HeroProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">Independent benchmark notes</p>
        <h1 id="hero-title">Choose tools with evidence.</h1>
        <p className="hero-deck">Reproducible shootouts for devtools and architecture, with raw runs, test rigs, and honest limits.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#latest">
            See the result
            <ArrowDown aria-hidden="true" />
          </a>
          <a className="text-link" href="#method">
            Read the method
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <figure className="hero-visual">
        <img src="/images/lab-bench.webp" width="1584" height="1024" fetchPriority="high" alt="Open computer and measuring equipment on a graphite workbench." />
        <figcaption>{featured ? `First result: ${featured.title}` : "The first result is loading."}</figcaption>
      </figure>
    </section>
  );
}
