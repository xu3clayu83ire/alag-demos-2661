import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';
import { Construct } from 'constructs';

export class RepoRadarStack extends cdk.Stack {
  public readonly connectionsTable: dynamodb.Table;
  public readonly fn: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // T25: DynamoDB 連線表
    this.connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'RepoRadarConnections',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'sessionId-index',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // T26: Lambda Function（esbuild 打包 handler.ts）
    this.fn = new nodejs.NodejsFunction(this, 'RepoRadarFn', {
      functionName: 'repo-radar',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../backend/src/handler.ts'),
      // projectRoot 設為 backend，讓 esbuild 能解析 node_modules
      projectRoot: path.join(__dirname, '../../backend'),
      depsLockFilePath: path.join(__dirname, '../../backend/package-lock.json'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
      },
    });

    // 賦予 Lambda 對 DynamoDB 的讀寫權限
    this.connectionsTable.grantReadWriteData(this.fn);

    // 賦予 Lambda 自我 async invoke 的權限（analyzeRepo 用）
    // 使用 account ARN 格式避免 CDK circular dependency
    this.fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:repo-radar`],
    }));

    // T27: HTTP API Gateway — ANY /graphql → Lambda
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'repo-radar-http',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    httpApi.addRoutes({
      path: '/graphql',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('GraphqlIntegration', this.fn),
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.apiEndpoint + '/graphql',
      description: 'HTTP API GraphQL endpoint',
    });

    // T28: WebSocket API Gateway — $connect/$disconnect/$default → Lambda
    const wsApi = new apigwv2.CfnApi(this, 'WsApi', {
      name: 'repo-radar-ws',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.type',
    });

    const wsIntegration = new apigwv2.CfnIntegration(this, 'WsIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${this.fn.functionArn}/invocations`,
    });

    // Lambda 允許 WebSocket API Gateway 呼叫
    this.fn.addPermission('WsApiInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*/*`,
    });

    for (const routeKey of ['$connect', '$disconnect', '$default']) {
      const id = routeKey.replace('$', '');
      new apigwv2.CfnRoute(this, `WsRoute${id}`, {
        apiId: wsApi.ref,
        routeKey,
        target: `integrations/${wsIntegration.ref}`,
      });
    }

    const wsStage = new apigwv2.CfnStage(this, 'WsStage', {
      apiId: wsApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // wsHandler 需要能呼叫 postToConnection，賦予 manage-connections 權限
    this.fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/${wsStage.stageName}/*`],
    }));

    new cdk.CfnOutput(this, 'WsApiUrl', {
      value: `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`,
      description: 'WebSocket API endpoint',
    });

    // 讓 streamingTask 知道 WebSocket PostToConnection 的 endpoint
    this.fn.addEnvironment(
      'WS_CALLBACK_URL',
      `https://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`,
    );

    // T29: S3 + CloudFront 前端靜態託管
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      // SPA 路由：所有 404 導回 index.html
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket name for frontend deploy',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL',
    });
  }
}
