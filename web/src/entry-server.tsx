import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import App from "./App";
import { CatalogProvider } from "./catalog-context";
import { headTags, prerenderPaths, routeMeta } from "./head";
import type { BenchmarkCatalog } from "./types";

export { prerenderPaths };

export function render(path: string, catalog: BenchmarkCatalog): { html: string; head: string } {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={path}>
        <CatalogProvider initial={catalog}>
          <App />
        </CatalogProvider>
      </StaticRouter>
    </StrictMode>,
  );

  return { html, head: headTags(routeMeta(path, catalog)) };
}
