export interface CommitInfo {
    id: string
    message: string
    timestamp: string
    filesChanged: string[]
    additions: number
    deletions: number
  }
  
  export async function getCommitDetails(
    commitSha: string
  ): Promise<CommitInfo> {
    const [owner, repo] = process.env.GITHUB_REPO!.split('/')
  
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
  
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  
    const data = await res.json()
  
    return {
      id: data.sha,
      message: data.commit.message,
      timestamp: data.commit.author.date,
      filesChanged: data.files.map((f: any) => f.filename),
      additions: data.stats.additions,
      deletions: data.stats.deletions
    }
  }