import { CfnOutput, CfnParameter, Fn, Stack, Tags } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class WarefeatsProxyBenchStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      description: "Ephemeral EC2 benchmark rig for proxy-bench (opt-in, workflow_dispatch only)",
    });

    const ami = new CfnParameter(this, "AmiId", {
      type: "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>",
      default: "/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id",
      description: "ARM64 AMI resolved from SSM at deploy time",
    });

    const siteBucketName = Fn.importValue("Warefeats-SiteBucketName");

    // Default VPC — zero cost, already exists in every account, public IPs for SSM.
    // CfnSecurityGroup without VpcId defaults to the account's default VPC.
    const sg = new ec2.CfnSecurityGroup(this, "Sg", {
      groupDescription: "proxy-bench: intra-group traffic only, no SSH",
    });

    new ec2.CfnSecurityGroupIngress(this, "IntraGroup", {
      groupId: sg.attrGroupId,
      sourceSecurityGroupId: sg.attrGroupId,
      ipProtocol: "-1",
      description: "all traffic within the bench cluster",
    });

    const placementGroup = new ec2.CfnPlacementGroup(this, "Cluster", {
      strategy: "cluster",
    });

    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(this, "SSMCore", "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"),
      ],
    });

    const bucket = s3.Bucket.fromBucketName(this, "SiteBucket", siteBucketName);
    bucket.grantPut(role, "bench-runs/*");

    const instanceProfile = new iam.CfnInstanceProfile(this, "InstanceProfile", {
      roles: [role.roleName],
    });

    const userData = Fn.base64([
      "#!/bin/bash",
      "set -euxo pipefail",
      "shutdown -h +120",
      "export DEBIAN_FRONTEND=noninteractive",
      "apt-get update -qq",
      "apt-get install -y -qq docker.io jq curl git unzip",
      "systemctl enable --now docker",
      "usermod -aG docker ubuntu",
      "usermod -aG docker ssm-user || true",
      "curl -fsSL https://github.com/hatoo/oha/releases/download/v1.16.0/oha-linux-aarch64 -o /usr/local/bin/oha && chmod +x /usr/local/bin/oha",
      "curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash",
      "git clone --depth 1 https://github.com/johncarmack1984/warefeats.git /opt/warefeats",
      "cd /opt/warefeats && bun install --frozen-lockfile",
    ].join("\n"));

    const makeLT = (logicalId: string, instanceType: string): ec2.CfnLaunchTemplate => {
      return new ec2.CfnLaunchTemplate(this, logicalId, {
        launchTemplateData: {
          instanceType,
          imageId: ami.valueAsString,
          iamInstanceProfile: { name: instanceProfile.ref },
          securityGroupIds: [sg.attrGroupId],
          userData,
          instanceInitiatedShutdownBehavior: "terminate",
          blockDeviceMappings: [{
            deviceName: "/dev/sda1",
            ebs: { volumeSize: 30, volumeType: "gp3" },
          }],
          metadataOptions: { httpTokens: "required", httpEndpoint: "enabled" },
          tagSpecifications: [{
            resourceType: "instance",
            tags: [
              { key: "Project", value: "warefeats" },
              { key: "Component", value: "proxy-bench" },
            ],
          }, {
            resourceType: "volume",
            tags: [
              { key: "Project", value: "warefeats" },
              { key: "Component", value: "proxy-bench" },
            ],
          }],
        },
      });
    };

    const clientLT = makeLT("ClientLT", "c7g.xlarge");
    const engineLT = makeLT("EngineLT", "c7g.metal");
    const originLT = makeLT("OriginLT", "c7g.xlarge");

    Tags.of(this).add("Project", "warefeats");
    Tags.of(this).add("Component", "proxy-bench");

    new CfnOutput(this, "ClientLaunchTemplateId", { value: clientLT.ref });
    new CfnOutput(this, "EngineLaunchTemplateId", { value: engineLT.ref });
    new CfnOutput(this, "OriginLaunchTemplateId", { value: originLT.ref });
    new CfnOutput(this, "PlacementGroupName", { value: placementGroup.ref });
    new CfnOutput(this, "SecurityGroupId", { value: sg.attrGroupId });
    new CfnOutput(this, "InstanceRoleArn", { value: role.roleArn });
    new CfnOutput(this, "SiteBucketNameOut", { value: siteBucketName });
  }
}
