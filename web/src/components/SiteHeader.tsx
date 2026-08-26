import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="warefeats home">
        <span className="wordmark-mark" aria-hidden="true">wf</span>
        <span>warefeats</span>
      </a>
      <nav className="primary-nav" aria-label="Primary navigation">
        <a href="#latest">Latest</a>
        <a href="#method">Method</a>
        <a href="#queue">Queue</a>
      </nav>
      <div className="header-actions">
        <a className="github-link" href="https://github.com/johncarmack1984/warefeats" target="_blank" rel="noreferrer">
          <GithubLogo aria-hidden="true" />
          <span>Source</span>
          <ArrowUpRight aria-hidden="true" />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
