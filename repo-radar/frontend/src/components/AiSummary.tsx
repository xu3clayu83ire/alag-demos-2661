import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { ANALYZE_REPO } from '../graphql/operations';
import { wsClient } from '../graphql/client';

interface AiSummaryProps {
  owner: string;
  repo: string;
}

interface AnalysisChunk { sessionId: string; chunk: string; done: boolean; }

/** AI 分析元件：觸發 mutation 取得 sessionId，用 wsClient 原生訂閱串流 chunks */
export function AiSummary({ owner, repo }: AiSummaryProps) {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);

  const [analyzeRepo, { loading: mutationLoading }] = useMutation<{ analyzeRepo: string }>(ANALYZE_REPO);

  const handleAnalyze = () => {
    const sid = `session-${Date.now()}`;
    setText('');
    setDone(false);
    setStreaming(true);

    // 先建立訂閱，再觸發 mutation，確保 WS 連線在 streamingTask polling 前就緒
    const unsubscribe = wsClient.subscribe<{ onAnalysisUpdate: AnalysisChunk }>(
      {
        query: `subscription OnAnalysisUpdate($sessionId: String!) {
          onAnalysisUpdate(sessionId: $sessionId) { sessionId chunk done }
        }`,
        variables: { sessionId: sid },
      },
      {
        next: (result) => {
          console.log('[sub] next', result);
          const chunk = result.data?.onAnalysisUpdate;
          if (!chunk) return;
          if (chunk.done) {
            setDone(true);
            setStreaming(false);
            unsubscribe();
          } else {
            setText((prev) => prev + chunk.chunk);
          }
        },
        error: (err) => {
          console.error('[sub] error', err);
          setStreaming(false);
        },
        complete: () => {
          console.log('[sub] complete');
          setStreaming(false);
        },
      },
    );

    // 訂閱發出後再觸發 mutation（WS 連線此時已在建立中）
    analyzeRepo({ variables: { owner, repo, sessionId: sid } }).catch((err) => {
      console.error('[mutation] error', err);
      setStreaming(false);
      unsubscribe();
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-gray-100 font-semibold">AI 摘要</h2>
        {streaming && (
          <span className="text-xs px-2 py-1 rounded-full bg-violet-900 text-violet-300">● 分析中...</span>
        )}
        {done && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-900 text-green-300">✅ 分析完成</span>
        )}
      </div>

      {text ? (
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
          {text}
          {streaming && (
            <span className="animate-pulse inline-block w-2 h-4 bg-violet-400 ml-0.5 align-middle" />
          )}
        </p>
      ) : (
        <div className="flex-1 flex items-center justify-center py-6">
          <button
            onClick={handleAnalyze}
            disabled={mutationLoading || streaming}
            className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {mutationLoading ? '啟動中...' : '🤖 開始 AI 分析'}
          </button>
        </div>
      )}

      {done && (
        <button
          onClick={handleAnalyze}
          className="self-center bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-gray-700"
        >
          🤖 重新分析
        </button>
      )}
    </div>
  );
}
