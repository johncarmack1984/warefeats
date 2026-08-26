# AWS deployment setup

The deploy workflow uses GitHub OIDC, so it does not store AWS access keys. The one-time setup requires local AWS credentials with permission to bootstrap CDK and create the deploy role.

1. Bootstrap the target account and region with `bunx cdk bootstrap aws://ACCOUNT_ID/us-east-1`.
2. Create the GitHub OIDC role with `aws cloudformation deploy --template-file infra/github-oidc-role.yml --stack-name warefeats-github-oidc --capabilities CAPABILITY_NAMED_IAM --parameter-overrides GitHubOrg=johncarmack1984 GitHubRepository=warefeats`.
3. Read the role ARN with `aws cloudformation describe-stacks --stack-name warefeats-github-oidc --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text`.
4. Save that ARN as the repository Actions secret `AWS_DEPLOY_ROLE_ARN` and set the optional Actions variable `AWS_REGION` if the target is not `us-east-1`.

If the AWS account already has a GitHub Actions OIDC provider, pass `ExistingOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com` in step 2.

The hosting bucket is private, versioned, encrypted, and retained if the stack is deleted. CloudFront is the only public origin path. A push to `main` runs checks and tests, deploys the stack, uploads the static build, and invalidates the distribution.
