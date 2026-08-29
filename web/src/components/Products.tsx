import type { Benchmark } from "../types";

interface ProductsProps {
  benchmark: Benchmark;
}

/** The products under test, logo and pinned version, where barefeats put the product photo. */
export function Products({ benchmark }: ProductsProps) {
  return (
    <section className="products" aria-labelledby="products-title">
      <h2 id="products-title">Products compared</h2>
      <ul className="product-list">
        {benchmark.candidates.map((candidate) => {
          const isWinner = candidate.id === benchmark.verdict.winnerId;
          return (
            <li className={isWinner ? "product is-fastest" : "product"} key={candidate.id}>
              {candidate.logo ? <img className="product-logo" src={candidate.logo} alt="" width="56" height="56" /> : <span className="product-logo product-logo-blank" aria-hidden="true" />}
              <span className="product-name">
                {candidate.homepage ? <a href={candidate.homepage} target="_blank" rel="noreferrer">{candidate.name}</a> : candidate.name}
              </span>
              <span className="product-version num">v{candidate.version}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
