import { useState, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_REPO } from '../graphql/operations';

interface Commit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

interface RepoInfo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  commits: Commit[];
}

interface RepoInputProps {
  initialOwner?: string;
  initialRepo?: string;
  /** 查詢成功後回傳 repo 資訊與 owner/repo 名稱 */
  onRepoLoaded: (repoInfo: RepoInfo, owner: string, repo: string) => void;
}

/** 輸入 owner / repo 並觸發 getRepo query */
export function RepoInput({ initialOwner = '', initialRepo = '', onRepoLoaded }: RepoInputProps) {
  const [owner, setOwner] = useState(initialOwner);
  const [repo, setRepo] = useState(initialRepo);

  const [fetchRepo, { loading, error, data }] = useLazyQuery<{ getRepo: RepoInfo }>(GET_REPO);

  useEffect(() => {
    if (data?.getRepo) onRepoLoaded(data.getRepo, owner.trim(), repo.trim());
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner.trim() || !repo.trim()) return;
    fetchRepo({ variables: { owner: owner.trim(), repo: repo.trim() } });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Owner</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="owner"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 w-44"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Repo</label>
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="repo"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 w-44"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? '查詢中...' : '查詢 Repo'}
      </button>
      {error && (
        <p className="text-red-400 text-sm self-center">
          ⚠ 找不到此 repo，請確認名稱是否正確
        </p>
      )}
    </form>
  );
}
