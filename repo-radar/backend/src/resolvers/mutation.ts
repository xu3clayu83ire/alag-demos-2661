import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getRepoInfo } from '../services/github';
import { streamAnalysis } from '../services/anthropic';

interface MutationContext {
  callbackUrl?: string;
}

const lambdaClient = new LambdaClient({});

/**
 * Lambda 環境下，用 async invoke 啟動另一個 Lambda 實例跑 streaming，
 * 避免當前 Lambda 在 HTTP response 回傳後被凍結導致 streaming 中斷。
 */
async function invokeStreamingAsync(
  sessionId: string,
  owner: string,
  repo: string,
  callbackUrl: string,
): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'repo-radar';
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // async，不等回傳
      Payload: Buffer.from(
        JSON.stringify({ __streamingTask: true, sessionId, owner, repo, callbackUrl }),
      ),
    }),
  );
}

// Mutation resolver：觸發 AI 分析，立即回傳 sessionId
export const mutationResolvers = {
  analyzeRepo: async (
    _: unknown,
    args: { owner: string; repo: string; sessionId?: string },
    context: MutationContext,
  ): Promise<string> => {
    const sessionId = args.sessionId ?? `session-${Date.now()}`;

    if (context.callbackUrl) {
      // Lambda 環境：async invoke 另一個實例跑 streaming
      await invokeStreamingAsync(sessionId, args.owner, args.repo, context.callbackUrl);
    } else {
      // 本地環境：直接背景執行
      const repoInfo = await getRepoInfo(args.owner, args.repo);
      streamAnalysis(sessionId, repoInfo.commits, undefined).catch(console.error);
    }

    return sessionId;
  },
};
