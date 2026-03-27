'use client'

import { useEffect, useState } from 'react'
import PulseVoice from './PulseVoice'

interface Ticket {
  key: string
  summary: string
  status: string
  priority: string
  daysOpen: number
  assignee: string | null
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('progress')) return 'bg-blue-500/20 text-blue-400'
  if (s.includes('review')) return 'bg-yellow-500/20 text-yellow-400'
  if (s.includes('done')) return 'bg-green-500/20 text-green-400'
  return 'bg-zinc-700/50 text-zinc-400'
}

function stalenessIndicator(daysOpen: number, status: string): string {
  if (status.toLowerCase().includes('done')) return ''
  if (daysOpen >= 3) return '⚠️'
  return ''
}

function buildSprintBrief(tickets: Ticket[]): string {
  const stale = tickets.filter(t =>
    t.daysOpen >= 3 && !t.status.toLowerCase().includes('done')
  )

  let brief = `You have ${tickets.length} tickets in your current sprint. `

  tickets.forEach(t => {
    brief += `${t.key}: ${t.summary}, status ${t.status}, open for ${t.daysOpen} days. `
  })

  if (stale.length > 0) {
    brief += `Warning: ${stale.map(t => t.key).join(' and ')} ${stale.length === 1 ? 'has' : 'have'} been open for 3 or more days with no recent activity.`
  }

  return brief
}

export default function SprintBoard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sprintBrief, setSprintBrief] = useState('')

  useEffect(() => {
    const fetchSprint = async () => {
      try {
        const res = await fetch('/api/sprint')
        if (!res.ok) throw new Error('Failed to fetch sprint')
        const data = await res.json()
        setTickets(data.tickets)
        setSprintBrief(buildSprintBrief(data.tickets))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchSprint()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-zinc-500">
      Loading sprint...
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-40 text-red-400">
      {error}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          Current Sprint
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {tickets.length} tickets
          </span>
        </h2>
        <PulseVoice text={sprintBrief} />
      </div>

      <div className="flex flex-col gap-3">
        {tickets.map(ticket => (
          <div
            key={ticket.key}
            className="flex items-start justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-500">
                  {ticket.key}
                </span>
                {stalenessIndicator(ticket.daysOpen, ticket.status) && (
                  <span title="Stale ticket">
                    {stalenessIndicator(ticket.daysOpen, ticket.status)}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-100">{ticket.summary}</p>
              <p className="text-xs text-zinc-500">
                Open {ticket.daysOpen} day{ticket.daysOpen !== 1 ? 's' : ''}
                {ticket.assignee ? ` · ${ticket.assignee}` : ''}
              </p>
            </div>
            <span className={`
              text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap
              ${statusColor(ticket.status)}
            `}>
              {ticket.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}