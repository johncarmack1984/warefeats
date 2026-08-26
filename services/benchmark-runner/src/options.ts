export interface RunnerOptions {
  runs: number;
  warmups: number;
  output?: string;
}

function positiveInteger(flag: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

export function parseOptions(args: string[]): RunnerOptions {
  const options: RunnerOptions = { runs: 20, warmups: 3 };

  for (const argument of args) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--quick") {
      options.runs = 3;
      options.warmups = 1;
      continue;
    }

    if (argument.startsWith("--runs=")) {
      options.runs = positiveInteger("--runs", argument.slice("--runs=".length));
      continue;
    }

    if (argument.startsWith("--warmups=")) {
      options.warmups = positiveInteger("--warmups", argument.slice("--warmups=".length));
      continue;
    }

    if (argument.startsWith("--output=")) {
      const output = argument.slice("--output=".length);
      if (!output) {
        throw new Error("--output needs a file path.");
      }
      options.output = output;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}
