import { Link, useLocation } from "react-router";

export function NotFound() {
  const location = useLocation();

  return (
    <section className="state-panel">
      <h1>No page at <code>{location.pathname}</code>.</h1>
      <p>The index lists every published run, and the queue shows what is coming.</p>
      <Link className="button" to="/">Go to the benchmarks</Link>
    </section>
  );
}
