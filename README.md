# warefeats

warefeats is a benchmark comparison publication for developer tools and architecture choices. Every conclusion includes the workload, pinned tool versions, test rig, protocol, limitations, and raw samples.

## Workspace

- `web/` contains the React and Vite publication UI plus the versioned benchmark catalog. Routes are `/` (index of every benchmark by category plus the queue), `/benchmarks/<slug>/`, `/methodology/`, and `/about/`; `bun run build` prerenders each route to static HTML with its own metadata, and a new catalog entry becomes a page with no new page code.
- `infra/` contains the AWS CDK stack for private S3 and CloudFront hosting.
- `.github/workflows/deploy.yml` verifies and deploys every push to `main`.

## Local development

Run `bun install`, then `bun run --cwd web dev` for the site (`bun run --cwd web preview` serves the prerendered `web/dist`). Run `bun run check`, `bun run test`, and `bun run build` before pushing.

## Deployment

The production workflow expects the `AWS_DEPLOY_ROLE_ARN` repository secret and optionally the `AWS_REGION` repository variable. Follow [infra/README.md](infra/README.md) once per AWS account, then every push to `main` deploys the CDK stack, syncs `web/dist`, and invalidates CloudFront.

## Related repositories

Benchmarks live in their own repos under the [warefeats](https://github.com/warefeats) org; this repo is the publication site only.

- [warefeats/js-linter-tools](https://github.com/warefeats/js-linter-tools) — the ESLint vs Biome reproducible runner.
- [warefeats/http-caching-proxies](https://github.com/warefeats/http-caching-proxies) — the Varnish vs Vinyl vs NGINX HLS caching-proxy runner.

Each runner repo publishes to this site by writing its catalog entry into `web/public/data/benchmarks.json`; see the runner repo's README for its import command.
