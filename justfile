set dotenv-load

export AWS_DEFAULT_REGION := "us-east-1"
export CDK_DEFAULT_ACCOUNT := "735853783919"
export CDK_DEFAULT_REGION := "us-east-1"

check:
    bun run check

test:
    bun run test

build:
    bun run build

dev:
    bun run --cwd web dev

benchmark:
    bun run benchmark:lint

benchmark-smoke:
    bun run benchmark:smoke

proxy-bench:
    bun run benchmark:proxy

proxy-bench-smoke:
    bun run benchmark:proxy-smoke

proxy-bench-clean:
    #!/usr/bin/env bash
    set -euo pipefail
    cd services/proxy-bench/compose
    for f in docker-compose.*.yml; do
        p=$(basename "$f" .yml | sed 's/docker-compose\./bench-/')
        docker compose -f "$f" -p "$p" down -v --remove-orphans 2>/dev/null || true
    done

synth:
    bun run infra:synth

deploy: build
    bun run infra:deploy -- --require-approval never --outputs-file ../infra-outputs.json

upload:
    #!/usr/bin/env bash
    set -euo pipefail
    BUCKET=$(jq -r '.WarefeatsStack.SiteBucketName' infra-outputs.json)
    aws s3 sync web/dist "s3://$BUCKET" --delete --cache-control "public,max-age=3600"
    aws s3 sync web/dist "s3://$BUCKET" --exclude "*" --include "*.html" --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"
    aws s3 sync web/dist/data "s3://$BUCKET/data" --cache-control "public,max-age=300" --content-type "application/json"

invalidate:
    #!/usr/bin/env bash
    set -euo pipefail
    DIST_ID=$(jq -r '.WarefeatsStack.DistributionId' infra-outputs.json)
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

ship: deploy upload invalidate

# one-time: clean up the failed us-west-1 stack from initial deploy
cleanup-failed:
    aws s3 rb s3://warefeatsstack-sitebucket397a1860-uougq9jialzg --region us-west-1
    aws cloudformation delete-stack --stack-name WarefeatsStack --region us-west-1

# one-time: create the github actions OIDC deploy role
setup-oidc:
    #!/usr/bin/env bash
    set -euo pipefail
    aws cloudformation deploy \
        --template-file infra/github-oidc-role.yml \
        --stack-name warefeats-github-oidc \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ExistingOidcProviderArn=arn:aws:iam::735853783919:oidc-provider/token.actions.githubusercontent.com
    ROLE_ARN=$(aws cloudformation describe-stacks \
        --stack-name warefeats-github-oidc \
        --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
        --output text)
    gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo johncarmack1984/warefeats
    echo "OIDC role: $ROLE_ARN"

# cloud benchmark rig (infra/lib/proxy-bench-stack.ts + .github/workflows/proxy-bench-cloud.yml)
proxy-bench-deploy:
    bun run infra:deploy -- WarefeatsProxyBench --require-approval never

proxy-bench-oidc: setup-oidc

# dispatch the cloud run from the current branch; matrix=smoke|full, engine=c7g.metal|c7g.4xlarge
proxy-bench-cloud matrix="smoke" engine="c7g.metal":
    gh workflow run proxy-bench-cloud.yml --ref "$(git branch --show-current)" -f matrix={{matrix}} -f engine_type={{engine}} --repo johncarmack1984/warefeats

proxy-bench-cloud-watch:
    gh run watch --repo johncarmack1984/warefeats "$(gh run list --repo johncarmack1984/warefeats --workflow proxy-bench-cloud.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status

proxy-bench-cloud-results:
    #!/usr/bin/env bash
    set -euo pipefail
    BUCKET=$(aws cloudformation describe-stacks --stack-name WarefeatsStack --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" --output text)
    aws s3 ls "s3://$BUCKET/bench-runs/" --recursive | tail -20

# tear the (opt-in) cloud rig back down; the site stack is untouched
proxy-bench-destroy:
    cd infra && bunx cdk destroy WarefeatsProxyBench --force
