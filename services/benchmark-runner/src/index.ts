import { parseOptions } from "./options";
import { runLintBenchmark, writeResult } from "./run";

async function main(): Promise<void> {
  const options = parseOptions(Bun.argv.slice(2));
  const result = await runLintBenchmark(options);
  await writeResult(result, options.output);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Benchmark failed: ${message}\n`);
  process.exitCode = 1;
});
