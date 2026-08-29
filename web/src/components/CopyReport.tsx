import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { reportText } from "../metrics";
import type { Benchmark } from "../types";

interface CopyReportProps {
  benchmark: Benchmark;
}

/** Copies the report in hyperfine's plain-text shape, ready to paste into an issue or a chat. */
export function CopyReport({ benchmark }: CopyReportProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") {
      return;
    }

    const timer = window.setTimeout(() => setState("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(reportText(benchmark));
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button className="button" type="button" onClick={() => void copy()} aria-live="polite">
      {state === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {state === "copied" ? "Copied as text" : state === "failed" ? "Clipboard blocked" : "Copy report as text"}
    </button>
  );
}
