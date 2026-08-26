import { test } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { WarefeatsStack } from "../lib/warefeats-stack";

test("keeps the origin private and serves it through CloudFront", () => {
  const app = new App();
  const stack = new WarefeatsStack(app, "TestStack", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::S3::Bucket", 1);
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: Match.arrayWith([
        Match.objectLike({ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }),
      ]),
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
    VersioningConfiguration: { Status: "Enabled" },
  });

  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: "index.html",
      HttpVersion: "http2and3",
      IPV6Enabled: true,
      PriceClass: "PriceClass_100",
      Enabled: true,
      Aliases: ["warefeats.com", "www.warefeats.com"],
    }),
  });

  template.hasResourceProperties("AWS::CertificateManager::Certificate", {
    DomainName: "warefeats.com",
    SubjectAlternativeNames: ["www.warefeats.com"],
  });

  template.resourceCountIs("AWS::Route53::RecordSet", 5);
});
