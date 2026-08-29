import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource-variable/red-hat-text/index.css";
import "@fontsource-variable/red-hat-text/wght-italic.css";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { parseCatalog } from "./catalog";
import { CatalogProvider } from "./catalog-context";
import "./styles.css";
import type { BenchmarkCatalog } from "./types";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The application root element is missing.");
}

function embeddedCatalog(): BenchmarkCatalog | undefined {
  const node = document.getElementById("wf-catalog");
  if (!node?.textContent) {
    return undefined;
  }

  try {
    return parseCatalog(JSON.parse(node.textContent));
  } catch {
    return undefined;
  }
}

const initial = embeddedCatalog();
const app = (
  <StrictMode>
    <BrowserRouter>
      <CatalogProvider initial={initial}>
        <App />
      </CatalogProvider>
    </BrowserRouter>
  </StrictMode>
);

const prerenderedPath = root.dataset.path;
const matchesPrerender = root.hasChildNodes() && prerenderedPath === window.location.pathname.replace(/\/+$/, "") + (window.location.pathname === "/" ? "/" : "");

if (matchesPrerender) {
  hydrateRoot(root, app);
} else {
  root.replaceChildren();
  createRoot(root).render(app);
}
