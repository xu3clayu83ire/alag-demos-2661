import 'dotenv/config';
import { streamAnalysis } from './services/anthropic';
import { pubsub } from './pubsub';
import { Commit } from './types';

// 模擬測試用 commits 資料
const mockCommits: Commit[] = [
  { sha: 'abc1', message: 'feat: add dark mode support', author: 'Alice', timestamp: '2024-05-01T10:00:00Z' },
  { sha: 'abc2', message: 'fix: resolve memory leak in useEffect', author: 'Bob', timestamp: '2024-05-02T11:00:00Z' },
  { sha: 'abc3', message: 'refactor: extract shared utils', author: 'Alice', timestamp: '2024-05-03T09:30:00Z' },
  { sha: 'abc4', message: 'chore: upgrade dependencies', author: 'Charlie', timestamp: '2024-05-04T14:00:00Z' },
  { sha: 'abc5', message: 'feat: implement lazy loading for images', author: 'Bob', timestamp: '2024-05-05T16:00:00Z' },
];

const sessionId = `test-${Date.now()}`;

// 訂閱 pubsub 事件，印出每個 chunk
pubsub.subscribe('ANALYSIS_UPDATE', (payload: { onAnalysisUpdate: { sessionId: string; chunk: string; done: boolean } }) => {
  const { chunk, done } = payload.onAnalysisUpdate;
  if (done) {
    console.log('\n\n[done: true]');
    process.exit(0);
  } else {
    process.stdout.write(chunk);
  }
});

console.log(`[sessionId: ${sessionId}] 開始分析...\n`);
streamAnalysis(sessionId, mockCommits).catch(console.error);
