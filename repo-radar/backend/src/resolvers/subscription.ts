import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../pubsub';

// Subscription resolver：訂閱分析更新，只回傳 sessionId 匹配的 chunks
export const subscriptionResolvers = {
  onAnalysisUpdate: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe: withFilter(
      () => (pubsub as any).asyncIterableIterator('ANALYSIS_UPDATE'),
      (payload: any, variables: any) =>
        !!payload && payload.onAnalysisUpdate.sessionId === variables.sessionId,
    ),
  },
};
