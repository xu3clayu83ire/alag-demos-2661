interface Commit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

interface CommitListProps {
  commits: Commit[];
}

/** 顯示最新 commits 列表 */
export function CommitList({ commits }: CommitListProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-gray-100 font-semibold mb-4">最新 Commits</h2>
      <ul className="space-y-3">
        {commits.map((commit) => (
          <li key={commit.sha} className="border-b border-gray-800 pb-3 last:border-0 last:pb-0">
            <p className="text-gray-100 text-sm leading-snug line-clamp-2">{commit.message}</p>
            <div className="flex gap-2 mt-1 text-xs text-gray-400">
              <span>@{commit.author}</span>
              <span>·</span>
              <span>{new Date(commit.timestamp).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-gray-500 text-xs mt-3">共 {commits.length} 筆</p>
    </div>
  );
}
