#!/usr/bin/env bun
import { App } from "aws-cdk-lib";
import { WarefeatsProxyBenchStack } from "../lib/proxy-bench-stack";
import { WarefeatsStack } from "../lib/warefeats-stack";

const app = new App();

const site = new WarefeatsStack(app, "WarefeatsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "Private S3 and CloudFront hosting for warefeats",
});

new WarefeatsProxyBenchStack(app, "WarefeatsProxyBench", {
  siteBucket: site.siteBucket,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
