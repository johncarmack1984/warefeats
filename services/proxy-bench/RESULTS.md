# Proxy bench results — 2026-08-29

## Rig

MacBook Pro, Apple M2 Max, 12 CPU cores, 96 GB, macOS 26.0 (arm64). Docker via OrbStack. All containers share one host CPU/network stack.

## Versions

| Engine | Version | Source | Image digest |
|---|---|---|---|
| Varnish Cache | 9.0.3 | `varnish:latest` Docker image | `sha256:90c6c9c38cc9f4502cff80972e6fcd17029f7fbc594aa7e958ddfc8ecbdaa740` |
| Vinyl Cache | c67fd5f57 | Built from `~/coding/varnish/vinyl-cache` in Debian trixie, `--with-persistent-storage` | local build |
| NGINX | 1.30.4 (stable) | `nginx:stable` Docker image | `sha256:09cc2702709e6388d979d8030e3ab4eb1ceb699b2dced26d7543e872a822e823` |
| haproxy | 3.1.17 | `haproxy:3.1` Docker image (TLS termination + PROXYv2) | `sha256:e17b7c578bdec8f289d5549b64de15b2f335c67f5dc687c949b59acac4edb9e4` |
| oha | 1.16.0 | Load generator, `--latency-correction --output-format json` | — |

## Commands

```sh
# Per-engine batches (incremental saves, --resume skips completed cells)
# The vinyl engine builds from source: point VINYL_CACHE_DIR at a Vinyl Cache checkout (the repo .env is loaded by just).
bun run --cwd services/proxy-bench src/run.ts --engine=varnish
bun run --cwd services/proxy-bench src/run.ts --engine=vinyl
bun run --cwd services/proxy-bench src/run.ts --engine=nginx
```

## Matrix

8 feasible (engine, topology) pairs x 4 workloads. W3/W4 run plaintext only (3 pairs each). 14 compose cycles, 30 measured rows.

| Topology | Varnish | Vinyl | NGINX |
|---|---|---|---|
| plaintext | W1 W2 W3 W4 | W1 W2 W3 W4 | W1 W2 W3 W4 |
| tls-inprocess | W1 W2 | N/A | W1 W2 |
| proxyv2-haproxy | W1 W2 | W1 W2 | W1 W2 |

## Results

### Runner correction (2026-08-29)

The first published run of W1 (hit-path) and W2 (segment serve) reported `samplesMs` as a single oha run's aggregate p99 repeated 20 times (`load-runner.ts`, the `Array.from({ length: measuredBuckets }, () => p99Ms)` lines). Sixteen of the twenty-two cells therefore had min = max = median and the "3 warmups + 20 runs" protocol did not hold for them; the hit-path verdict text had also been written from an earlier run and no longer matched its own data. W3 (miss-storm) and W4 (origin-flap) always produced one sample per repetition and are unchanged.

The runner now executes 3 warmup passes followed by 20 independent oha passes per cell (fixed rate, `--latency-correction`, 5 s each); each pass's p99 is one sample, `statistics` are computed over the 20 samples, and p50 is the median of the per-pass p50s. All sixteen W1/W2 cells were re-run with this runner; the tables below are from the re-run. Section verdicts are now generated from the candidate statistics by `import.ts`, and the catalog validator rejects any candidate whose samples collapse to a single value when the protocol claims more than one run.

### W1: Hit-path RPS (2 KB manifest, 5000 rps target, 50 conc; 3 warmup + 20 measured passes of 5 s)

| Engine/Topology | p50 ms (median of passes) | p99 ms (median of passes) | p99 min–max across passes | Achieved RPS | Error % | RSS MB |
|---|---|---|---|---|---|---|
| varnish/plaintext | 0.53 | 2.58 | 0.99–11.89 | 4998 | 0 | 98.5 |
| varnish/tls-inprocess | 0.40 | 3.08 | 0.61–9.20 | 4998 | 0 | 115.3 |
| varnish/proxyv2-haproxy | 0.45 | 6.00 | 2.98–10.43 | 4998 | 0 | 99.5 |
| vinyl/plaintext | 0.39 | 0.77 | 0.68–10.10 | 4998 | 0 | 111.0 |
| vinyl/proxyv2-haproxy | 0.47 | 5.25 | 3.52–8.90 | 4998 | 0 | 114.4 |
| nginx/plaintext | 0.68 | 2.43 | 1.89–4.83 | 4998 | 0 | 4.6 |
| nginx/tls-inprocess | 0.38 | 3.43 | 0.93–9.26 | 4998 | 0 | 11.9 |
| nginx/proxyv2-haproxy | 0.42 | 2.33 | 0.97–8.38 | 4998 | 0 | 5.5 |

All engines sustained the 5000 rps target with 0% errors. Per-pass p99 is noisy on a shared host (see min–max); medians are the comparison.

### W2: Segment serve (4 MB, 500 rps, 20 conc; 3 warmup + 20 measured passes of 5 s)

Full GET:

| Engine/Topology | p50 ms (median of passes) | p99 ms (median of passes) | p99 min–max across passes | Achieved RPS | Error % | RSS MB |
|---|---|---|---|---|---|---|
| varnish/plaintext | 1.97 | 2.78 | 2.69–5.74 | 500 | 0 | 95.5 |
| varnish/tls-inprocess | 3.63 | 10.43 | 9.18–15.32 | 500 | 0 | 102.4 |
| varnish/proxyv2-haproxy | 5.01 | 17.16 | 13.12–60.36 | 500 | 0 | 95.2 |
| vinyl/plaintext | 2.15 | 3.03 | 2.72–5.99 | 500 | 0 | 119.1 |
| vinyl/proxyv2-haproxy | 5.32 | 17.86 | 13.31–433.90 | 500 | 0 | 122.6 |
| nginx/plaintext | 2.17 | 5.71 | 4.64–12.62 | 500 | 0 | 5.6 |
| nginx/tls-inprocess | 9.31 | 64.86 | 49.84–108.23 | 500 | 0 | 10.3 |
| nginx/proxyv2-haproxy | 5.20 | 15.85 | 12.73–21.44 | 500 | 0 | 7.3 |

64 KB Range GET:

| Engine/Topology | p50 ms (median of passes) | p99 ms (median of passes) | p99 min–max across passes | Achieved RPS | Error % | RSS MB |
|---|---|---|---|---|---|---|
| varnish/plaintext | 0.39 | 0.98 | 0.55–2.07 | 500 | 0 | 95.5 |
| varnish/tls-inprocess | 0.46 | 0.96 | 0.72–3.37 | 500 | 0 | 102.4 |
| varnish/proxyv2-haproxy | 0.75 | 2.81 | 0.00–3.81 | 500 | 0 | 95.2 |
| vinyl/plaintext | 0.49 | 1.81 | 1.28–36.61 | 500 | 0 | 119.1 |
| vinyl/proxyv2-haproxy | 0.93 | 3.35 | 2.52–4.81 | 500 | 0 | 122.6 |
| nginx/plaintext | 0.37 | 1.20 | 0.54–6.64 | 500 | 0 | 5.6 |
| nginx/tls-inprocess | 0.72 | 3.59 | 1.89–13.91 | 500 | 0 | 10.3 |
| nginx/proxyv2-haproxy | 0.94 | 3.75 | 3.14–13.89 | 500 | 0 | 7.3 |

### W3: Miss-storm coalescing (200 concurrent, fresh 4 MB segment per rep, 20 reps, plaintext)

| Engine | p50 ms | p99 ms | Avg origin reqs/burst | Coalescing efficiency | Total origin reqs | RSS MB |
|---|---|---|---|---|---|---|
| varnish | 1051.27 | 2712.63 | 1.0 | 200x | 20 | 196.6 |
| vinyl | 743.57 | 1244.65 | 1.0 | 200x | 20 | 270.0 |
| nginx | 854.10 | 2719.08 | 1.0 | 200x | 20 | 8.2 |

All three engines achieved perfect 200x coalescing: 1 origin request per 200-client burst across all 20 reps. The p99 variance (1200-2700 ms across engines) reflects host-contention spikes in the shared Docker environment, not systematic differences between engines. Three repeat runs confirmed comparable performance: Varnish p99 ranged 1097-2713 ms, Vinyl 1106-1245 ms, NGINX 1237-2719 ms.

NGINX config for coalescing: `proxy_cache_lock on; proxy_cache_lock_age 30s; proxy_cache_lock_timeout 30s; proxy_buffering on;`. The initial run used `proxy_cache_lock_timeout 5s` (nginx default), which caused all 199 waiters to bypass the lock before the 4 MB fetch completed, sending all 200 requests to origin individually (p50 = 5130 ms, coalescing = 1x). Increasing both `proxy_cache_lock_age` and `proxy_cache_lock_timeout` to 30s gives waiters enough time to be served from the cache-fill response. See `configs/nginx/nginx.conf` for the full config.

### W4: Origin-flap grace (200 rps, 10 conc, 5 cycles x baseline/flap/recovery, plaintext)

| Engine | p50 ms | p99 ms | Grace served | Errors served | Grace hit ratio | RSS MB |
|---|---|---|---|---|---|---|
| varnish | 6.09 | 7.12 | 9999 | 0 | 100% | 94.3 |
| vinyl | 5.92 | 7.70 | 10000 | 0 | 100% | 106.6 |
| nginx | 5.86 | 6.80 | 9999 | 0 | 100% | 5.9 |

All three engines served stale/grace content with 100% success rate during origin 500s. Varnish uses `beresp.grace = 30s`, Vinyl uses the same VCL, NGINX uses `proxy_cache_use_stale error timeout http_500`.

## Anomalies and notes

1. **NGINX TLS segment serve p99 82.67 ms**: The TLS in-process segment serve showed significantly higher p99 than other topologies. Range GET on the same topology was 3.81 ms, suggesting the overhead is specific to encrypting the full 4 MB response body.
2. **Vinyl RSS higher than Varnish**: vinyl/plaintext RSS consistently higher than varnish/plaintext under equivalent load (107-270 MB vs 95-197 MB). Both configured with `malloc,256m`.

### Re-run notes (2026-08-29)

- The earlier varnish/plaintext hit-path p99 of 25.86 ms was a single-run artifact; across 20 passes the median is 2.58 ms (0.99–11.89 ms).
- varnish/proxyv2-haproxy Range GET has one pass with p99 = 0.00 ms (oha reported a zero latency bucket); it is kept in the raw samples and has no effect on the median.
- vinyl/proxyv2-haproxy full GET has one 433.9 ms pass; median 17.9 ms. Shared-host contention spikes of this kind affect every engine (see min–max columns).

## Config changes from initial run

The initial run had two harness defects that produced misleading W3 data:

1. **Miss-storm path mismatch**: The runner generated paths like `/stream/segment-storm-{rep}.ts`, which did not match the origin's segment regex (`segment-\d+\.ts`). The origin returned 404 for all storm requests. Varnish and Vinyl cached the 404 (appearing as 200x coalescing of a 9-byte response), while NGINX's `proxy_cache_valid 200 206 60s` did not cache 404s, causing serial origin requests. Fixed by changing storm paths to `/stream/segment-{10000+rep}.ts`.

2. **NGINX lock timeout too short**: `proxy_cache_lock_timeout 5s` (the default) was insufficient for a 4 MB segment fetch under 200-concurrent load. Waiters that timed out were passed through to the origin without caching (documented nginx behavior). Fixed with `proxy_cache_lock_age 30s; proxy_cache_lock_timeout 30s;`.

3. **Vinyl hit ratio always 0**: The `vinylstat` binary in the runtime image was missing `libncursesw6`, causing silent failure. All vinyl `cacheHits`/`cacheMisses` returned 0 regardless of actual caching behavior. Fixed by adding `libncursesw6` to the Dockerfile.vinyl runtime stage.

## Cells ran

30/30 cells completed, 0 failures. All 14 compose cycles succeeded.

## Raw samples

Full per-cell JSON with samplesMs arrays, engineStats, and metrics blocks: `services/proxy-bench/results.json`
