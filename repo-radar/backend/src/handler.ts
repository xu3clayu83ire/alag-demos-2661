import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { queryResolvers } from './resolvers/query';
import { mutationResolvers } from './resolvers/mutation';
import { subscriptionResolvers } from './resolvers/subscription';
import { saveConnection, deleteConnection, bindSessionId } from './services/websocket';
import { getRepoInfo } from './services/github';
import { streamAnalysis } from './services/anthropic';

interface LambdaContext {
  callbackUrl?: string;
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: queryResolvers,
    Mutation: mutationResolvers,
    Subscription: subscriptionResolvers,
  },
});

const apollo = new ApolloServer<LambdaContext>({ schema });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const _apolloHandler = startServerAndCreateLambdaHandler(
  apollo,
  handlers.createAPIGatewayProxyEventV2RequestHandler(),
  {
    context: async ({ event }) => {
      const domainName = (event as { requestContext?: { domainName?: string } }).requestContext?.domainName;
      const stage = (event as { requestContext?: { stage?: string } }).requestContext?.stage;
      const callbackUrl = domainName && stage ? `https://${domainName}/${stage}` : undefined;
      return { callbackUrl };
    },
  },
);

/**
 * HTTP API Gateway handler：處理 Query 與 Mutation
 * OPTIONS preflight 直接短路回傳 CORS headers，避免 Apollo CSRF 防護攔截
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const httpHandler = async (event: any, context: any) => {
  if (event?.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (_apolloHandler as any)(event, context);
  return { ...result, headers: { ...result?.headers, ...CORS_HEADERS } };
};

/**
 * WebSocket API Gateway handler：處理 $connect / $disconnect / $default
 * $default 實作 graphql-ws 握手：收到 connection_init 回 connection_ack
 */
export const wsHandler = async (event: {
  requestContext: {
    routeKey: string;
    connectionId: string;
    domainName: string;
    stage: string;
  };
  queryStringParameters?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number }> => {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  const callbackUrl = `https://${domainName}/${stage}`;

  if (routeKey === '$connect') {
    const sessionId = event.queryStringParameters?.sessionId ?? '';
    await saveConnection(connectionId, sessionId);
    return { statusCode: 200 };
  }

  if (routeKey === '$disconnect') {
    await deleteConnection(connectionId);
    return { statusCode: 200 };
  }

  // $default：處理 graphql-ws 協定訊息
  if (event.body) {
    const msg = JSON.parse(event.body) as { type: string; id?: string; payload?: { variables?: { sessionId?: string } } };
    console.log('[ws $default]', connectionId, 'type:', msg.type);
    if (msg.type === 'connection_init') {
      const { ApiGatewayManagementApiClient, PostToConnectionCommand } = await import('@aws-sdk/client-apigatewaymanagementapi');
      const mgmt = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
      await mgmt.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify({ type: 'connection_ack' })),
      }));
    } else if (msg.type === 'subscribe') {
      // 收到 subscribe 訊息時，從 variables 提取 sessionId 並綁定到此連線
      // msg.id 是 graphql-ws 的 subscription id，推送 next 訊息時需帶上
      const sid = msg.payload?.variables?.sessionId;
      const subId = msg.id ?? '';
      console.log('[ws subscribe] connectionId:', connectionId, 'sessionId:', sid, 'subscriptionId:', subId);
      if (sid) await bindSessionId(connectionId, sid, subId);
    }
  }

  return { statusCode: 200 };
};

/**
 * 統一入口：依 event 結構判斷走 HTTP handler、WebSocket handler 或 streaming task
 * CDK 兩個 API 都指向同一個 Lambda，靠 requestContext 區分
 * __streamingTask 為 mutation async invoke 觸發的背景串流任務
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any, context: any) => {
  // streaming task：由 analyzeRepo mutation async invoke 觸發
  if (event?.__streamingTask) {
    const { sessionId, owner, repo } = event;
    // 優先用 WS_CALLBACK_URL 環境變數（WebSocket API endpoint），fallback 到 event 傳入的值
    const callbackUrl = process.env.WS_CALLBACK_URL ?? event.callbackUrl;
    console.log('[streamingTask] sessionId:', sessionId, 'callbackUrl:', callbackUrl);
    // 輪詢 DynamoDB，等待前端 subscribe bind sessionId 完成（最多 10 秒）
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    let connections: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const result = await dynamo.send(new QueryCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME ?? 'RepoRadarConnections',
        IndexName: 'sessionId-index',
        KeyConditionExpression: 'sessionId = :sid',
        ExpressionAttributeValues: { ':sid': sessionId },
      }));
      connections = result.Items ?? [];
      console.log(`[streamingTask] poll ${i + 1}: found ${connections.length} connections`);
      if (connections.length > 0) break;
    }
    if (connections.length === 0) {
      console.log('[streamingTask] no connections found after 10s, abort');
      return;
    }
    const repoInfo = await getRepoInfo(owner, repo);
    await streamAnalysis(sessionId, repoInfo.commits, callbackUrl);
    return;
  }

  // WebSocket event 的 routeKey 為 $connect / $disconnect / $default
  // HTTP API Gateway v2 event 的 routeKey 為 "METHOD /path"，用 $ 前綴區分
  const routeKey: string = event?.requestContext?.routeKey ?? '';
  if (routeKey.startsWith('$')) {
    return wsHandler(event);
  }
  return httpHandler(event, context);
};
