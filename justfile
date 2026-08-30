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
    : "${GITHUB_ORG_ID:?set GITHUB_ORG_ID to the numeric id from: gh api orgs/warefeats -q .id}"
    aws cloudformation deploy \
        --template-file infra/github-oidc-role.yml \
        --stack-name warefeats-github-oidc \
        --capabilities CAPABILITY_NAMED_IAM \
        --no-fail-on-empty-changeset \
        --parameter-overrides \
            ExistingOidcProviderArn=arn:aws:iam::735853783919:oidc-provider/token.actions.githubusercontent.com \
            GitHubOrg=warefeats \
            GitHubRepository=warefeats.com \
            GitHubOrgId=$GITHUB_ORG_ID \
            GitHubRepositoryId=1346850977
    ROLE_ARN=$(aws cloudformation describe-stacks \
        --stack-name warefeats-github-oidc \
        --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
        --output text)
    gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo warefeats/warefeats.com
    echo "OIDC role: $ROLE_ARN"
