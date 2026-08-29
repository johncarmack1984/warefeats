import { GithubLogo } from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

export const REPO_URL = "https://github.com/johncarmack1984/warefeats";

export function SiteHeader() {
  return (
    <header className="site-header">
      <NavLink className="wordmark" to="/" aria-label="warefeats home" end>
        <span className="wordmark-prompt" aria-hidden="true">$</span>
        <span>warefeats</span>
      </NavLink>
      <nav className="primary-nav" aria-label="Primary">
        <NavLink to="/" end>Benchmarks</NavLink>
        <NavLink to="/methodology">Methodology</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <div className="header-actions">
        <a className="github-link" href={REPO_URL} target="_blank" rel="noreferrer">
          <GithubLogo aria-hidden="true" />
          <span>Source</span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
