# warefeats

warefeats is a benchmark comparison publication for developer tools and architecture choices. Every conclusion includes the workload, pinned tool versions, test rig, protocol, limitations, and raw samples.

## Workspace

- `web/` contains the React and Vite publication UI. Routes are `/` (index of every benchmark by category plus the queue), `/benchmarks/<slug>/`, `/methodology/`, and `/about/`; `bun run build` prerenders each route to static HTML with its own metadata, and a new catalog entry becomes a page with no new page code.
- `infra/` contains the AWS CDK stack for private S3 and CloudFront hosting.
- `.github/workflows/deploy.yml` verifies and deploys every push to `main`.

## Catalog

Benchmark results live in the repos that produced them. The site holds a registry of pinned commit SHAs and assembles the catalog at build time.

- `web/data/registry.json` pins each benchmark slug to a repo and full SHA.
- `web/data/queue.json` holds the editorial queue (planned, running, published).
- `web/data/cache/<slug>.json` is the assembled legacy `Benchmark` object for each entry, committed for reviewable diffs and offline builds.
- `web/data/cache/manifest.json` records the slug-to-repo-and-ref mapping the cache was built from.

Runner repos:

- [warefeats/js-linter-tools](https://github.com/warefeats/js-linter-tools) — the ESLint vs Biome reproducible runner.
- [warefeats/http-caching-proxies](https://github.com/warefeats/http-caching-proxies) — the Varnish vs Vinyl vs NGINX HLS caching-proxy runner.

### Publish flow

1. Run the benchmark in its runner repo; the importer writes `runs/<file>.json` and updates `benchmark.json`; PR, merge.
2. In this repo: bump that slug's `ref` in `web/data/registry.json` to the new SHA, run `bun run sync`, commit registry + cache together, PR, merge → deploy.

## Local development

Run `bun install`, then `bun run --cwd web dev` for the site (`bun run --cwd web preview` serves the prerendered `web/dist`). Run `bun run check`, `bun run test`, and `bun run build` before pushing.

### Syncing benchmark data

`bun run sync` (from `web/`) fetches each pinned benchmark's `benchmark.json` and run files from GitHub, validates, assembles the legacy catalog shape, and writes the cache. Run it after bumping a ref in `registry.json` or when setting up the repo for the first time.

## Deployment

The production workflow expects the `AWS_DEPLOY_ROLE_ARN` repository secret and optionally the `AWS_REGION` repository variable. Follow [infra/README.md](infra/README.md) once per AWS account, then every push to `main` deploys the CDK stack, syncs `web/dist`, and invalidates CloudFront.
