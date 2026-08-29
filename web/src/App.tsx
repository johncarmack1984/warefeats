import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { useCatalog } from "./catalog-context";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { routeMeta } from "./head";
import { About } from "./routes/About";
import { BenchmarkPage } from "./routes/BenchmarkPage";
import { Home } from "./routes/Home";
import { Methodology } from "./routes/Methodology";
import { NotFound } from "./routes/NotFound";

function useDocumentMeta(): void {
  const location = useLocation();
  const { state } = useCatalog();

  useEffect(() => {
    const meta = routeMeta(location.pathname, state.status === "ready" ? state.catalog : undefined);
    document.title = meta.title;
    const set = (selector: string, value: string) => document.querySelector(selector)?.setAttribute("content", value);
    set('meta[name="description"]', meta.description);
    set('meta[property="og:title"]', meta.title);
    set('meta[property="og:description"]', meta.description);
    // Keep the origin the server put on the image tag (the dev server points it at itself).
    const served = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    const origin = served && /^https?:\/\//.test(served) ? new URL(served).origin : "https://warefeats.com";
    const image = meta.image.replace("https://warefeats.com", origin);
    set('meta[property="og:image"]', image);
    set('meta[name="twitter:image"]', image);
    set('meta[property="og:url"]', `https://warefeats.com${meta.path}`);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", `https://warefeats.com${meta.path}`);
  }, [location.pathname, state]);

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);
}

export default function App() {
  useDocumentMeta();

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/benchmarks/:slug" element={<BenchmarkPage />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
    </>
  );
}
