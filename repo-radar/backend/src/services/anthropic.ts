import Anthropic from '@anthropic-ai/sdk';
import { pubsub } from '../pubsub';
import { pushToConnections } from './websocket';
import { Commit } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** 判斷目前是否在 Lambda 環境執行 */
const isLambda = !!process.env.AWS_EXECUTION_ENV;

// 將 commits 陣列轉換成供 AI 分析的文字摘要
function buildPrompt(commits: Commit[]): string {
  const lines = commits.map(
    (c, i) => `${i + 1}. [${c.timestamp.slice(0, 10)}] ${c.author}: ${c.message}`,
  );
  return (
    `以下是一個 GitHub Repository 最近 ${commits.length} 筆 commits，請用繁體中文簡短分析開發趨勢、主要變更方向及值得注意的模式：\n\n` +
    lines.join('\n')
  );
}

/**
 * 推送單一 chunk：
 * - Lambda 環境：透過 WebSocket API Gateway postToConnection
 * - 本地環境：透過 in-memory PubSub
 */
async function publishChunk(
  sessionId: string,
  chunk: string,
  done: boolean,
  callbackUrl?: string,
): Promise<void> {
  const payload = { sessionId, chunk, done };
  if (isLambda && callbackUrl) {
    await pushToConnections(sessionId, payload, callbackUrl);
  } else {
    pubsub.publish('ANALYSIS_UPDATE', { onAnalysisUpdate: payload });
  }
}

/**
 * 呼叫 Anthropic streaming API 分析 commits，
 * 每個 chunk 透過對應模式推送，完成時發布 done: true
 */
export async function streamAnalysis(
  sessionId: string,
  commits: Commit[],
  callbackUrl?: string,
): Promise<void> {
  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(commits) }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      await publishChunk(sessionId, event.delta.text, false, callbackUrl);
    }
  }

  await publishChunk(sessionId, '', true, callbackUrl);
}
