import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME ?? 'RepoRadarConnections';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * WebSocket $connect：將 connectionId 存入 DynamoDB，TTL 2 小時
 * sessionId 可為空（連線建立時尚未知道），非空時才寫入供 GSI 查詢
 */
export async function saveConnection(connectionId: string, sessionId: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 2;
  const item: Record<string, unknown> = { connectionId, ttl };
  if (sessionId) item['sessionId'] = sessionId;
  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  );
}

/**
 * 將 sessionId 與 subscriptionId 綁定到已存在的 connectionId
 * subscriptionId 是 graphql-ws subscribe 訊息的 id，推送 next 訊息時需帶上
 */
export async function bindSessionId(connectionId: string, sessionId: string, subscriptionId: string): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { connectionId },
      UpdateExpression: 'SET sessionId = :sid, subscriptionId = :subId',
      ExpressionAttributeValues: { ':sid': sessionId, ':subId': subscriptionId },
    }),
  );
}

/**
 * WebSocket $disconnect：從 DynamoDB 刪除 connectionId
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { connectionId },
    }),
  );
}

/**
 * 查詢對應 sessionId 的所有 connectionId，並透過 API Gateway 推送 payload
 */
export async function pushToConnections(
  sessionId: string,
  payload: { sessionId: string; chunk: string; done: boolean },
  callbackUrl: string,
): Promise<void> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'sessionId-index',
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
    }),
  );

  const mgmt = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
  const connectionIds = (result.Items ?? []).map((item) => item['connectionId'] as string);

  // GSI 是 KEYS_ONLY，需要用 connectionId GetItem 取得完整資料（含 subscriptionId）
  const fullItems = await Promise.all(
    connectionIds.map((connectionId) =>
      dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { connectionId } }))
        .then((r) => r.Item),
    ),
  );

  await Promise.all(
    fullItems.filter(Boolean).map(async (item) => {
      try {
        await mgmt.send(
          new PostToConnectionCommand({
            ConnectionId: item!['connectionId'] as string,
            Data: Buffer.from(JSON.stringify({
              type: 'next',
              id: item!['subscriptionId'] as string,
              payload: { data: { onAnalysisUpdate: payload } },
            })),
          }),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 410 Gone：連線已斷開；404 Not Found：connectionId 不存在，兩者皆忽略
        if (status !== 410 && status !== 404) throw err;
      }
    }),
  );
}
