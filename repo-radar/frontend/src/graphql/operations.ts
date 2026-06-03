import { gql } from '@apollo/client';

/** 查詢 repo 基本資訊與最新 commits */
export const GET_REPO = gql`
  query GetRepo($owner: String!, $repo: String!) {
    getRepo(owner: $owner, repo: $repo) {
      name
      description
      stars
      forks
      openIssues
      commits {
        sha
        message
        author
        timestamp
      }
    }
  }
`;

/** 觸發 AI 分析，回傳 sessionId */
export const ANALYZE_REPO = gql`
  mutation AnalyzeRepo($owner: String!, $repo: String!, $sessionId: String) {
    analyzeRepo(owner: $owner, repo: $repo, sessionId: $sessionId)
  }
`;

/** 訂閱 AI 分析串流，依 sessionId 過濾 */
export const ON_ANALYSIS_UPDATE = gql`
  subscription OnAnalysisUpdate($sessionId: String!) {
    onAnalysisUpdate(sessionId: $sessionId) {
      sessionId
      chunk
      done
    }
  }
`;
