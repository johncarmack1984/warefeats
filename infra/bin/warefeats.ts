#!/usr/bin/env bun
import { App } from "aws-cdk-lib";
import { WarefeatsStack } from "../lib/warefeats-stack";

const app = new App();

new WarefeatsStack(app, "WarefeatsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "Private S3 and CloudFront hosting for warefeats",
});
