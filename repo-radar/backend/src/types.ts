export interface Commit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface RepoInfo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  commits: Commit[];
}
