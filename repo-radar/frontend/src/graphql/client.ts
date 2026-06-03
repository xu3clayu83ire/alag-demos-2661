import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

/**
 * AWS API Gateway WebSocket 不回傳 Sec-WebSocket-Protocol header
 * 瀏覽器若送出 subprotocol 請求卻未收到回應會自動關閉連線
 * 用自訂 WebSocket 包裝器忽略 protocol 參數，不帶 subprotocol 連線
 */
class NoSubprotocolWebSocket extends WebSocket {
  constructor(url: string | URL, _protocols?: string | string[]) {
    super(url); // 故意不傳 protocols
  }
}

/** graphql-ws client，可直接用於原生 subscribe */
export const wsClient = createClient({
  url: 'wss://p1osj0cr9h.execute-api.us-east-1.amazonaws.com/prod',
  webSocketImpl: NoSubprotocolWebSocket,
  on: {
    connected: () => console.log('[ws] connected'),
    closed: (e) => console.log('[ws] closed', e),
    error: (e) => console.log('[ws] error', e),
    message: (msg) => console.log('[ws] message', JSON.stringify(msg)),
  },
});

/** WebSocket link，專門處理 Subscription */
const wsLink = new GraphQLWsLink(wsClient);

/** HTTP link，處理 Query 與 Mutation */
const httpLink = new HttpLink({
  uri: 'https://uq4q2huolb.execute-api.us-east-1.amazonaws.com/graphql',
});

/** 根據 operation 類型分流：Subscription 走 WS，其餘走 HTTP */
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
