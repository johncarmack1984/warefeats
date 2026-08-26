import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  const stored = window.localStorage.getItem("warefeats-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("warefeats-theme", theme);
  }, [theme]);

  const nextTheme = theme === "light" ? "dark" : "light";
  const label = `Use ${nextTheme} theme`;

  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={() => setTheme(nextTheme)}>
      {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}
