import { Link } from "react-router";
import { REPO_URL } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-lead">
        <span className="wordmark"><span className="wordmark-prompt" aria-hidden="true">$</span><span>warefeats</span></span>
        <span>Independent benchmarks for developer tools. Every run published, every rig named.</span>
      </p>
      <nav className="footer-nav" aria-label="Footer">
        <Link to="/">Benchmarks</Link>
        <Link to="/methodology">Methodology</Link>
        <Link to="/about">About</Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer">Source and runner</a>
        <a href="/data/benchmarks.json">Catalog JSON</a>
      </nav>
    </footer>
  );
}
