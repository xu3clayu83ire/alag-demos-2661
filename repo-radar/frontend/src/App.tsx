import { useState } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './graphql/client';
import { RepoInput } from './components/RepoInput';
import { CommitList } from './components/CommitList';
import { AiSummary } from './components/AiSummary';

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

/** 主應用：串接 RepoInput → CommitList → AiSummary 完整流程 */
function RepoRadar() {
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [repoTarget, setRepoTarget] = useState<{ owner: string; repo: string } | null>(null);

  const handleRepoLoaded = (info: RepoInfo, owner: string, repo: string) => {
    setRepoInfo(info);
    setRepoTarget({ owner, repo });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">🔭 RepoRadar</h1>
          <p className="text-gray-400 mt-1 text-sm">AI-powered GitHub repository analyzer</p>
        </header>

        {/* RepoInput */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
          <RepoInputWithTarget onRepoLoaded={handleRepoLoaded} />
        </div>

        {/* Main content */}
        {repoInfo && repoTarget && (
          <>
            {/* Repo Stats */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
              <h2 className="text-gray-100 font-semibold mb-3">{repoInfo.name}</h2>
              {repoInfo.description && (
                <p className="text-gray-400 text-sm mb-3">{repoInfo.description}</p>
              )}
              <div className="flex gap-4 text-sm text-gray-300">
                <span>⭐ {repoInfo.stars.toLocaleString()} stars</span>
                <span>🍴 {repoInfo.forks.toLocaleString()} forks</span>
                <span>❗ {repoInfo.openIssues.toLocaleString()} issues</span>
              </div>
            </div>

            {/* Left / Right split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CommitList commits={repoInfo.commits} />
              <AiSummary owner={repoTarget.owner} repo={repoTarget.repo} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 包裝 RepoInput，讓它能把 owner/repo 一起傳給 parent */
function RepoInputWithTarget({
  onRepoLoaded,
}: {
  onRepoLoaded: (info: RepoInfo, owner: string, repo: string) => void;
}) {
  const [owner, setOwner] = useState('xu3clayu83ire');
  const [repo, setRepo] = useState('alag-repo-radar');

  return (
    <RepoInput
      initialOwner={owner}
      initialRepo={repo}
      onRepoLoaded={(info, o, r) => {
        setOwner(o);
        setRepo(r);
        onRepoLoaded(info, o, r);
      }}
    />
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <RepoRadar />
    </ApolloProvider>
  );
}
