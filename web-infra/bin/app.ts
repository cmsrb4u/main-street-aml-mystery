#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { AmlWebStack } from '../lib/aml-web-stack';

const app = new cdk.App();
const account = app.node.tryGetContext('account') as string;
const region = app.node.tryGetContext('region') as string;
const runtimeArn = app.node.tryGetContext('runtimeArn') as string;

if (!account || !region || !runtimeArn) {
  throw new Error('CDK context must define account, region, and runtimeArn.');
}

new AmlWebStack(app, 'AmlGroundedAgentWeb', {
  env: { account, region },
  runtimeArn,
  description:
    'Authenticated React workspace for the evidence-grounded AML AgentCore runtime',
});
