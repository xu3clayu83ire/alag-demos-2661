#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
import * as cdk from 'aws-cdk-lib/core';
import { RepoRadarStack } from '../lib/repo-radar-stack';

const app = new cdk.App();
new RepoRadarStack(app, 'RepoRadarStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
