import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { ApolloServer, HeaderMap } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { typeDefs } from './schema';
import { queryResolvers } from './resolvers/query';
import { mutationResolvers } from './resolvers/mutation';
import { subscriptionResolvers } from './resolvers/subscription';

// 本地開發用 HTTP + WebSocket server，共用 port 4000
async function startServer() {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: queryResolvers,
      Mutation: mutationResolvers,
      Subscription: subscriptionResolvers,
    },
  });

  const httpServer = createServer();
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const wsCleanup = useServer({ schema }, wsServer);

  const apollo = new ApolloServer({
    schema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apollo.start();

  // 手動處理 HTTP request，轉交給 Apollo executeHTTPGraphQLRequest
  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    // 允許前端 dev server（localhost:5173）跨域請求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // GET / 回傳內嵌 Sandbox，避免 mixed content 問題
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      res.setHeader('Content-Type', 'text/html');
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Apollo Sandbox</title></head>
        <body style="margin:0">
        <div id="sandbox" style="position:fixed;inset:0"></div>
        <script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
        <script>
          new window.EmbeddedSandbox({
            target: '#sandbox',
            initialEndpoint: 'http://localhost:4000/graphql',
            initialSubscriptionEndpoint: 'ws://localhost:4000/graphql',
          });
        </script>
        </body>
        </html>
      `);
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString();

    const requestHeaders = new HeaderMap();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const result = await apollo.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: req.method ?? 'GET',
        headers: requestHeaders,
        search: new URL(req.url ?? '', 'http://localhost').search,
        body: body ? JSON.parse(body) : undefined,
      },
      context: async () => ({}),
    });

    res.statusCode = result.status ?? 200;
    for (const [key, value] of result.headers) res.setHeader(key, value);

    if (result.body.kind === 'complete') {
      res.end(result.body.string);
    } else {
      for await (const chunk of result.body.asyncIterator) res.write(chunk);
      res.end();
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(4000, resolve));
  console.log('Server ready at http://localhost:4000/graphql');
}

startServer();
