import { Moon, Sun } from "@phosphor-icons/react";

type Theme = "light" | "dark";

function resolvedTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") {
    return explicit;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The page follows the system appearance; this override lasts for the tab. Both glyphs render and
 * CSS shows the one for the active theme, so the server and client markup match.
 */
export function ThemeToggle() {
  function toggle(): void {
    const next: Theme = resolvedTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.sessionStorage.setItem("warefeats-theme", next);
    } catch {
      /* Storage is unavailable; the choice lasts until the next navigation. */
    }
  }

  return (
    <button className="icon-button theme-toggle" type="button" aria-label="Switch between light and dark theme" title="Switch theme" onClick={toggle}>
      <Moon className="theme-glyph theme-glyph-light" aria-hidden="true" />
      <Sun className="theme-glyph theme-glyph-dark" aria-hidden="true" />
    </button>
  );
}
