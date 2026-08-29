import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { QueueItem } from "../types";

interface QueueProps {
  items: QueueItem[];
}

const statusMark: Record<QueueItem["status"], string> = {
  Planned: "[ ]",
  Running: "[~]",
  Published: "[x]",
};

/** Planned runs as a checklist: status is a mark, not a color. */
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
    <section className="queue" id="queue" aria-labelledby="queue-title">
      <div className="section-head">
        <h2 id="queue-title">Queue</h2>
        <p>What runs next, in no promised order. Each entry becomes a page when its runner is reproducible.</p>
      </div>
      <div className="search-control">
        <label htmlFor="queue-query" className="sr-only">Filter the queue</label>
        <MagnifyingGlass aria-hidden="true" />
        <input id="queue-query" type="search" value={query} placeholder="Filter: caches, desktop, maps" onChange={(event) => setQuery(event.target.value)} />
        {query ? (
          <button type="button" aria-label="Clear filter" title="Clear filter" onClick={() => setQuery("")}>
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {matches.length ? (
        <ol className="queue-list">
          {matches.map((item) => (
            <li className="queue-item" key={item.title}>
              <span className="queue-mark num" aria-hidden="true">{statusMark[item.status]}</span>
              <span className="sr-only">{item.status}:</span>
              <span className="queue-category">{item.category}</span>
              <span className="queue-title">{item.title}</span>
              <span className="queue-question">{item.question}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="queue-empty" role="status">Nothing in the queue matches “{query}”. <button className="link-button" type="button" onClick={() => setQuery("")}>Clear the filter</button> to see every planned run.</p>
      )}
    </section>
  );
}
