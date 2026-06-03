import { PubSub } from 'graphql-subscriptions';

// 全域 PubSub 實例，供 Mutation 發布、Subscription 訂閱使用
export const pubsub = new PubSub();