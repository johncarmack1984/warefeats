import { useCallback, useEffect, useState } from "react";
import { parseCatalog } from "../catalog";
import type { BenchmarkCatalog } from "../types";

type CatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: BenchmarkCatalog }
  | { status: "error"; message: string };

export function useCatalog(): { state: CatalogState; reload: () => void } {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog(): Promise<void> {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/benchmarks.json`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Catalog request failed with ${response.status}.`);
        }

        const catalog = parseCatalog(await response.json());
        setState({ status: "ready", catalog });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "The benchmark catalog could not be loaded.";
        setState({ status: "error", message });
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [attempt]);

  return { state, reload };
}
