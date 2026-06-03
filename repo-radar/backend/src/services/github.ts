import { RepoInfo, Commit } from '../types';

// 從 GitHub REST API 取得 repo 基本資訊與最新 10 筆 commits
export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const [repoRes, commitsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, { headers }),
  ]);

  if (!repoRes.ok) throw new Error(`Repo not found: ${owner}/${repo}`);

  const repoData = await repoRes.json();
  const commitsData = await commitsRes.json();

  const commits: Commit[] = commitsData.map((c: any) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    timestamp: c.commit.author.date,
  }));

  return {
    name: repoData.name,
    description: repoData.description ?? null,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    commits,
  };
}
