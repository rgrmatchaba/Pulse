'use client'

import { useEffect, useState } from 'react'

interface CommitEvent {
  commitId: string
  message: string
  mappedTicket: string | null
  confidence: string
  reasoning: string
  timestamp: string
}

export default function CommitFeed() {
  const [commits, setCommits] = useState<CommitEvent[]>([])

  const fetchCommits = async () => {
    const res = await fetch('/api/webhooks/github')
    console.log(res.json());
    const data = await res.json()
    setCommits(data.commits)
  }

  useEffect(() => {
    fetchCommits()
    // Poll every 10 seconds for new commits
    const interval = setInterval(fetchCommits, 10000)
    return () => clearInterval(interval)
  }, [])

  if (commits.length === 0) return (
    <div className="text-xs text-zinc-600 text-center py-4">
      No commits yet — push something to GitHub
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-400">Recent Commits</h3>
      {commits.map((commit, i) => (
        <div
          key={i}
          className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col gap-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500">
              {commit.commitId}
            </span>
            {commit.mappedTicket ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                → {commit.mappedTicket}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-500">
                no match
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-300 truncate">{commit.message}</p>
          <p className="text-xs text-zinc-600">{commit.reasoning}</p>
        </div>
      ))}
    </div>
  )
}