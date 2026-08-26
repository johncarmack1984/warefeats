import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { arch, cpus, freemem, platform, release, totalmem } from "node:os";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { relativeSpeedup, summarize } from "./stats";
import type { RunnerOptions } from "./options";

interface CandidateDefinition {
  id: "eslint" | "biome";
  name: string;
  version: string;
  command: string[];
  displayCommand: string;
}

interface CandidateResult {
  id: string;
  name: string;
  version: string;
  command: string;
  exitCodes: number[];
  statistics: ReturnType<typeof summarize>;
  samplesMs: number[];
}

async function javascriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return javascriptFiles(path);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  }));

  return nested.flat().sort();
}

async function corpusSize(files: string[]): Promise<{ bytes: number; lines: number }> {
  let bytes = 0;
  let lines = 0;

  for (const file of files) {
    const [metadata, contents] = await Promise.all([stat(file), readFile(file, "utf8")]);
    bytes += metadata.size;
    lines += contents.match(/\n/g)?.length ?? 0;
  }

  return { bytes, lines };
}

function measure(command: string[]): { durationMs: number; exitCode: number } {
  const start = performance.now();
  const process = Bun.spawnSync({
    cmd: command,
    stdout: "ignore",
    stderr: "ignore",
  });
  const durationMs = Math.round((performance.now() - start) * 10) / 10;

  if (process.exitCode > 1) {
    throw new Error(`${basename(command[0] ?? "command")} exited with ${process.exitCode}.`);
  }

  return { durationMs, exitCode: process.exitCode };
}

function runCandidate(candidate: CandidateDefinition, options: RunnerOptions): CandidateResult {
  process.stderr.write(`Warming ${candidate.name} (${options.warmups} passes)\n`);
  for (let index = 0; index < options.warmups; index += 1) {
    measure(candidate.command);
  }

  process.stderr.write(`Measuring ${candidate.name} (${options.runs} passes)\n`);
  const samplesMs: number[] = [];
  const exitCodes = new Set<number>();
  for (let index = 0; index < options.runs; index += 1) {
    const sample = measure(candidate.command);
    samplesMs.push(sample.durationMs);
    exitCodes.add(sample.exitCode);
  }

  return {
    id: candidate.id,
    name: candidate.name,
    version: candidate.version,
    command: candidate.displayCommand,
    exitCodes: [...exitCodes].sort(),
    statistics: summarize(samplesMs),
    samplesMs,
  };
}

export async function runLintBenchmark(options: RunnerOptions): Promise<Record<string, unknown>> {
  const packageRoot = resolve(import.meta.dir, "..");
  const eslintSource = resolve(packageRoot, "node_modules/eslint/lib");
  const scratch = await mkdtemp(join(tmpdir(), "warefeats-lint-"));
  const corpusDirectory = join(scratch, "corpus");

  try {
    await cp(eslintSource, corpusDirectory, { recursive: true });
    const files = await javascriptFiles(corpusDirectory);
    const size = await corpusSize(files);
    const eslintBinary = resolve(packageRoot, "node_modules/.bin/eslint");
    const biomeBinary = resolve(packageRoot, "node_modules/.bin/biome");
    const eslintRules = JSON.stringify({
      "no-unused-vars": "error",
      eqeqeq: "error",
      "no-debugger": "error",
      "prefer-const": "error",
    });

    const definitions: CandidateDefinition[] = [
      {
        id: "eslint",
        name: "ESLint",
        version: "9.34.0",
        command: [eslintBinary, "--no-config-lookup", "--no-ignore", "--no-color", "--report-unused-disable-directives-severity", "off", "--rule", eslintRules, ...files],
        displayCommand: `eslint --no-config-lookup --no-ignore --rule '${eslintRules}' corpus/**/*.js`,
      },
      {
        id: "biome",
        name: "Biome",
        version: "2.2.2",
        command: [biomeBinary, "lint", "--colors=off", "--max-diagnostics=none", "--error-on-warnings", "--only=correctness/noUnusedVariables", "--only=suspicious/noDoubleEquals", "--only=suspicious/noDebugger", "--only=style/useConst", ...files],
        displayCommand: "biome lint --error-on-warnings --only=correctness/noUnusedVariables --only=suspicious/noDoubleEquals --only=suspicious/noDebugger --only=style/useConst corpus/**/*.js",
      },
    ];

    const candidates = definitions.map((definition) => runCandidate(definition, options));
    const eslint = candidates.find((candidate) => candidate.id === "eslint");
    const biome = candidates.find((candidate) => candidate.id === "biome");
    if (!eslint || !biome) {
      throw new Error("Both benchmark candidates must run.");
    }

    return {
      schemaVersion: 1,
      benchmark: "eslint-vs-biome-javascript-lint",
      generatedAt: new Date().toISOString(),
      corpus: {
        source: "eslint/lib/**/*.js",
        files: files.length,
        lines: size.lines,
        bytes: size.bytes,
      },
      environment: {
        cpu: cpus()[0]?.model ?? "Unknown CPU",
        logicalCores: cpus().length,
        architecture: arch(),
        platform: platform(),
        release: release(),
        totalMemoryBytes: totalmem(),
        freeMemoryBytesAtStart: freemem(),
        bun: Bun.version,
      },
      protocol: {
        warmups: options.warmups,
        runs: options.runs,
        processModel: "fresh process per pass",
      },
      candidates,
      speedup: relativeSpeedup(eslint.statistics.medianMs, biome.statistics.medianMs),
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function writeResult(result: Record<string, unknown>, output?: string): Promise<void> {
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (!output) {
    process.stdout.write(serialized);
    return;
  }

  const destination = resolve(process.cwd(), output);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, serialized, "utf8");
  process.stderr.write(`Wrote ${destination}\n`);
}
