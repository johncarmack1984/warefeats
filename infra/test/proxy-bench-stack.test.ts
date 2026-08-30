import { test } from "bun:test";
import { App, Stack } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Match, Template } from "aws-cdk-lib/assertions";
import { WarefeatsProxyBenchStack } from "../lib/proxy-bench-stack";

test("creates three launch templates, a placement group, and a security group", () => {
  const app = new App();
  const site = new Stack(app, "TestSite", { env: { account: "123456789012", region: "us-east-1" } });
  const siteBucket = new s3.Bucket(site, "SiteBucket");
  const stack = new WarefeatsProxyBenchStack(app, "TestBench", {
    siteBucket,
    env: { account: "123456789012", region: "us-east-1" },
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::EC2::LaunchTemplate", 3);
  template.resourceCountIs("AWS::EC2::PlacementGroup", 1);
  template.resourceCountIs("AWS::EC2::SecurityGroup", 1);

  template.hasResourceProperties("AWS::EC2::PlacementGroup", {
    Strategy: "cluster",
  });

  template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
    IpProtocol: "-1",
  });

  template.hasResourceProperties("AWS::EC2::LaunchTemplate", {
    LaunchTemplateData: Match.objectLike({
      InstanceType: "c7g.metal",
      InstanceInitiatedShutdownBehavior: "terminate",
    }),
  });

  template.hasResourceProperties("AWS::EC2::LaunchTemplate", {
    LaunchTemplateData: Match.objectLike({
      InstanceType: "c7g.xlarge",
    }),
  });

  template.hasResourceProperties("AWS::IAM::Role", {
    ManagedPolicyArns: Match.arrayWith([
      Match.stringLikeRegexp("AmazonSSMManagedInstanceCore"),
    ]),
  });

  template.resourceCountIs("AWS::IAM::InstanceProfile", 1);
});
