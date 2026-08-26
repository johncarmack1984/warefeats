import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export function BenchmarkSkeleton() {
  return (
    <section className="state-panel skeleton-panel" aria-label="Loading benchmark" aria-busy="true">
      <div className="skeleton skeleton-short" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-chart" />
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
      <WarningCircle size={28} aria-hidden="true" />
      <h2>The results did not load.</h2>
      <p>{message}</p>
      <button className="button button-primary" type="button" onClick={onRetry}>
        Try again
        <ArrowClockwise aria-hidden="true" />
      </button>
    </section>
  );
}

export function EmptyState() {
  return (
    <section className="state-panel">
      <h2>No published runs yet.</h2>
      <p>The catalog is valid, but it has no benchmark entries.</p>
      <a className="button button-primary" href="#queue">View the queue</a>
    </section>
  );
}
