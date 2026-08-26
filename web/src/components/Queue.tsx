import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { QueueItem } from "../types";

interface QueueProps {
  items: QueueItem[];
}

export function Queue({ items }: QueueProps) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }

    return items.filter((item) => `${item.category} ${item.title} ${item.question}`.toLowerCase().includes(needle));
  }, [items, query]);

  return (
    <section className="queue-section" id="queue" aria-labelledby="queue-title">
      <div className="queue-heading">
        <h2 id="queue-title">Next on the test rig</h2>
        <p>The queue favors consequential choices with reproducible workloads.</p>
      </div>
      <div className="queue-search">
        <label htmlFor="queue-query">Find a comparison</label>
        <div className="search-control">
          <MagnifyingGlass aria-hidden="true" />
          <input id="queue-query" type="search" value={query} placeholder="Try caches or desktop" onChange={(event) => setQuery(event.target.value)} />
          {query ? (
            <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery("")}>
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {matches.length ? (
        <div className="queue-grid">
          {matches.map((item) => (
            <article className="queue-item" key={item.title}>
              <div>
                <span className="queue-category">{item.category}</span>
                <span className="queue-status">{item.status}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.question}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="queue-empty" role="status">
          <h3>No queued comparison matches.</h3>
          <p>Clear the search to see every planned run.</p>
          <button className="button button-secondary" type="button" onClick={() => setQuery("")}>Clear search</button>
        </div>
      )}
    </section>
  );
}
