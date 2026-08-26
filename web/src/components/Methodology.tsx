import { Code, Cpu, Files, Repeat } from "@phosphor-icons/react";
import type { Benchmark } from "../types";

interface MethodologyProps {
  benchmark: Benchmark;
}

export function Methodology({ benchmark }: MethodologyProps) {
  return (
    <section className="method-section" id="method" aria-labelledby="method-title">
      <div className="method-image">
        <img src="/images/run-records.webp" width="1280" height="955" loading="lazy" alt="Stopwatch, paper timing traces, and a metal ruler on a workbench." />
      </div>
      <div className="method-copy">
        <h2 id="method-title">A result you can rerun.</h2>
        <p>Versions, corpus, commands, warmups, machine, and every sample ship with the conclusion.</p>
        <dl className="protocol-list">
          <div>
            <Code aria-hidden="true" />
            <dt>Pin the tools</dt>
            <dd>ESLint {benchmark.candidates[0]?.version} and Biome {benchmark.candidates[1]?.version} are locked in the workspace.</dd>
          </div>
          <div>
            <Repeat aria-hidden="true" />
            <dt>Warm, then fork</dt>
            <dd>{benchmark.protocol.warmups} warmups precede {benchmark.protocol.runs} fresh processes for each candidate.</dd>
          </div>
          <div>
            <Files aria-hidden="true" />
            <dt>Hold the corpus still</dt>
            <dd>Both tools receive the same {benchmark.corpus.files} JavaScript files in the same order.</dd>
          </div>
          <div>
            <Cpu aria-hidden="true" />
            <dt>Record the rig</dt>
            <dd>{benchmark.environment.machine}, {benchmark.environment.chip}, {benchmark.environment.memory}, {benchmark.environment.os}.</dd>
          </div>
        </dl>
      </div>

      <div className="rules-block">
        <h3>Matched rule intent</h3>
        <div className="rule-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col">ESLint</th>
                <th scope="col">Biome</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.ruleMap.map((rule) => (
                <tr key={rule.intent}>
                  <th scope="row">{rule.intent}</th>
                  <td><code>{rule.eslint}</code></td>
                  <td><code>{rule.biome}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="limits-block" aria-labelledby="limits-title">
        <h3 id="limits-title">What this does not prove</h3>
        <ul>
          {benchmark.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      </aside>
    </section>
  );
}
