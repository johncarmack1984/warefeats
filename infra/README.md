# AWS deployment setup

The deploy workflow uses GitHub OIDC, so it does not store AWS access keys. The one-time setup requires local AWS credentials with permission to bootstrap CDK and create the deploy role.

1. Bootstrap the target account and region with `bunx cdk bootstrap aws://ACCOUNT_ID/us-east-1`.
2. Create the GitHub OIDC role with `aws cloudformation deploy --template-file infra/github-oidc-role.yml --stack-name warefeats-github-oidc --capabilities CAPABILITY_NAMED_IAM --parameter-overrides GitHubOrg=johncarmack1984 GitHubRepository=warefeats`.
3. Read the role ARN with `aws cloudformation describe-stacks --stack-name warefeats-github-oidc --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text`.
4. Save that ARN as the repository Actions secret `AWS_DEPLOY_ROLE_ARN` and set the optional Actions variable `AWS_REGION` if the target is not `us-east-1`.

If the AWS account already has a GitHub Actions OIDC provider, pass `ExistingOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com` in step 2.

The hosting bucket is private, versioned, encrypted, and retained if the stack is deleted. CloudFront is the only public origin path. A push to `main` runs checks and tests, deploys the stack, uploads the static build, and invalidates the distribution.

## Proxy-bench cloud rig (Tier 2)

An opt-in CDK stack (`WarefeatsProxyBench`) that creates launch templates, a cluster placement group, a security group, and an IAM instance role for ephemeral EC2 benchmark runs. No instances are created at deploy time; the `proxy-bench-cloud.yml` workflow launches and terminates them per run.

### Architecture

Three arm64 EC2 instances in one AZ, connected via a cluster placement group for consistent sub-microsecond network latency:

| Role | Default type | vCPU | Purpose |
|---|---|---|---|
| engine | c7g.metal | 64 | Proxy under test (+ haproxy for PROXYv2 topology). Bare metal eliminates noisy-neighbor variance. |
| client | c7g.xlarge | 4 | Load generator (oha) and benchmark orchestrator. |
| origin | c7g.xlarge | 4 | TS origin server serving synthetic HLS manifests and segments. |

Uses the default VPC (zero cost, no NAT gateway). Security group allows only intra-group traffic. SSM Session Manager for access (no SSH keys). All instances auto-terminate after 120 minutes (`shutdown -h +120` in user data + `InstanceInitiatedShutdownBehavior=terminate`).

### vCPU quota

c7g.metal requires 64 vCPUs. The full rig (64 + 4 + 4 = 72 vCPUs) exceeds the default On-Demand Standard quota of 64 vCPUs (quota code `L-1216C47A`).

**Check current quota:**
```sh
aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A --query 'Quota.Value'
```

**Request increase to 128 vCPUs (one-time):**
```sh
aws service-quotas request-service-quota-increase --service-code ec2 --quota-code L-1216C47A --desired-value 128
```

**Fallback:** Pass `engine_type=c7g.4xlarge` (16 vCPU, total 24) to the workflow. Results will still be noise-free relative to Docker-on-laptop, but not bare-metal isolated.

### Cost estimate (us-east-1 on-demand)

| Instance | $/hr | Full run (~1 hr) | Smoke (~20 min) |
|---|---|---|---|
| 1× c7g.metal | $1.9264 | $1.93 | $0.64 |
| 2× c7g.xlarge | $0.2408 | $0.24 | $0.08 |
| **Total** | **$2.1672** | **$2.17** | **$0.72** |

With c7g.4xlarge fallback: $0.4816 + $0.2408 = **$0.72/hr** ($0.24 smoke).

S3 storage and SSM are negligible. No NAT gateway, no load balancer, no EBS beyond the 30 GB gp3 root volume included in each launch template.

### Guardrails against runaway spend

1. **`shutdown -h +120`** in user data — hard 2-hour wall clock.
2. **`InstanceInitiatedShutdownBehavior=terminate`** — shutdown deletes the instance.
3. **`if: always()` cleanup step** in the workflow terminates all three instances.
4. **Scheduled reaper** job runs after every workflow and terminates anything tagged `Component=proxy-bench` older than 3 hours.
5. **Tags** (`Project=warefeats`, `Component=proxy-bench`) on all resources for cost-dashboard filtering.
6. **Concurrency group** prevents parallel runs from stacking up instances.

### Deploy commands

CDK bootstrap is already done (step 1 above). Deploy the proxy-bench stack:

```sh
# Deploy the WarefeatsStack first (adds the SiteBucketName export)
bunx cdk deploy WarefeatsStack --require-approval never

# Deploy the proxy-bench stack
bunx cdk deploy WarefeatsProxyBench --require-approval never

# Update the OIDC role (adds ProxyBenchPolicy — redundant with PowerUserAccess but documents least-privilege)
aws cloudformation deploy --template-file infra/github-oidc-role.yml --stack-name warefeats-github-oidc --capabilities CAPABILITY_NAMED_IAM
```

### Run a benchmark

```sh
# Smoke run (~20 min, ~$0.72)
gh workflow run proxy-bench-cloud.yml -f matrix=smoke

# Full run (~1 hr, ~$2.17)
gh workflow run proxy-bench-cloud.yml -f matrix=full

# With fallback instance type (no quota increase needed)
gh workflow run proxy-bench-cloud.yml -f matrix=smoke -f engine_type=c7g.4xlarge
```

### Build the Vinyl GHCR image

The metal instance pulls a prebuilt Vinyl image instead of compiling from source:

```sh
gh workflow run build-vinyl.yml -f vinyl_ref=main
```

This pushes `ghcr.io/johncarmack1984/vinyl-cache:<ref>` and `latest`.
