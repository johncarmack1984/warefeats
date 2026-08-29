import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { parseCatalog } from "./catalog";
import type { BenchmarkCatalog } from "./types";

export type CatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: BenchmarkCatalog }
  | { status: "error"; message: string };

interface CatalogContextValue {
  state: CatalogState;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue>({ state: { status: "loading" }, reload: () => undefined });

interface CatalogProviderProps {
  initial?: BenchmarkCatalog;
  children: ReactNode;
}

export function CatalogProvider({ initial, children }: CatalogProviderProps) {
  const [state, setState] = useState<CatalogState>(initial ? { status: "ready", catalog: initial } : { status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (state.status !== "loading") {
      return;
    }

    const controller = new AbortController();

    async function loadCatalog(): Promise<void> {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/benchmarks.json`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Catalog request failed with ${response.status}.`);
        }

        setState({ status: "ready", catalog: parseCatalog(await response.json()) });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({ status: "error", message: error instanceof Error ? error.message : "The benchmark catalog could not be loaded." });
      }
    }

    void loadCatalog();
    return () => controller.abort();
    // The attempt counter is the retry trigger; the status guard keeps hydrated data from refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, state.status]);

  return <CatalogContext.Provider value={{ state, reload }}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  return useContext(CatalogContext);
}
