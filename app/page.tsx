'use client'

import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import SprintBoard from '@/components/SprintBoard'
import VoiceCommand from '@/components/VoiceCommand'
import CommitFeed from '@/components/CommitFeed'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [agentLog, setAgentLog] = useState<string[]>([])

  const handleTicketsUpdate = () => {
    // Increment key to force SprintBoard to re-fetch
    setRefreshKey(k => k + 1)
  }

  const handleResponse = (response: string) => {
    setAgentLog(prev => [response, ...prev].slice(0, 5))
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pulse</h1>
            <p className="text-sm text-zinc-500">Your AI engineering co-pilot</p>
          </div>
          <UserButton />
        </div>

        {/* Voice control — centre of the app */}
        <div className="flex flex-col items-center gap-2 py-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Voice Control
          </p>
          <VoiceCommand
            onResponse={handleResponse}
            onTicketsUpdate={handleTicketsUpdate}
          />
        </div>

        {/* Sprint board — refreshes after voice commands */}
        <SprintBoard key={refreshKey} />
       
<CommitFeed />

      </div>
    </main>
  )
}