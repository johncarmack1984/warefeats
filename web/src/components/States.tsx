import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { Link } from "react-router";

export function CatalogSkeleton() {
  return (
    <section className="state-panel skeleton-panel" aria-label="Loading benchmarks" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
    </section>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="state-panel" role="alert">
      <WarningCircle size={24} aria-hidden="true" />
      <h1>The catalog did not load.</h1>
      <p>{message}</p>
      <button className="button" type="button" onClick={onRetry}>
        <ArrowClockwise aria-hidden="true" />
        Try again
      </button>
    </section>
  );
}

export function EmptyState() {
  return (
    <section className="state-panel">
      <h1>No published runs yet.</h1>
      <p>The catalog is valid but has no benchmark entries. The queue below lists what is planned.</p>
      <Link className="button" to="/#queue">View the queue</Link>
    </section>
  );
}
