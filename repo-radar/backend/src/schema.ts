/**
 * 定義資料的形狀和操作
 * Commit、RepoInfo、AnalysisChunk	資料長什麼樣子（有哪些欄位、什麼型別）
 * Query.getRepo	可以查什麼、傳什麼參數、回傳什麼
 * Mutation.analyzeRepo	可以觸發什麼操作
 * Subscription.onAnalysisUpdate	可以訂閱什麼即時資料
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Commit {
    sha: String!
    message: String!
    author: String!
    timestamp: String!
  }

  type RepoInfo {
    name: String!
    description: String
    stars: Int!
    forks: Int!
    openIssues: Int!
    commits: [Commit!]!
  }

  type AnalysisChunk {
    sessionId: String!
    chunk: String!
    done: Boolean!
  }

  type Query {
    getRepo(owner: String!, repo: String!): RepoInfo!
  }

  type Mutation {
    analyzeRepo(owner: String!, repo: String!, sessionId: String): String!
  }

  type Subscription {
    onAnalysisUpdate(sessionId: String!): AnalysisChunk!
  }
`;