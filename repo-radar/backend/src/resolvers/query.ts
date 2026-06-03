import { getRepoInfo } from '../services/github';

// Query resolver：處理 getRepo 查詢，呼叫 GitHub Service 回傳 repo 資訊
export const queryResolvers = {
  getRepo: async (_: unknown, args: { owner: string; repo: string }) => {
    return getRepoInfo(args.owner, args.repo);
  },
};
