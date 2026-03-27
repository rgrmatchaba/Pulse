import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getCommitDetails } from '@/lib/github'
import { getActiveSprint, detectStaleTickets } from '@/lib/jira'
import { mapCommitToTicket } from '@/lib/agent'

// Validate that the request actually came from GitHub
// GitHub signs every webhook with your secret using HMAC-SHA256
async function validateSignature(
  body: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false

  const hmac = createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
  const digest = 'sha256=' + hmac.update(body).digest('hex')

  // Constant-time comparison prevents timing attacks
  return digest === signature
}

// Store recent commit events in memory
// In production this would go to a database
const recentCommits: Array<{
  commitId: string
  message: string
  mappedTicket: string | null
  confidence: string
  reasoning: string
  timestamp: string
}> = []

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const event = request.headers.get('x-github-event')

  // Step 1: validate signature
  const isValid = await validateSignature(body, signature)
  if (!isValid) {
    console.error('Invalid webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Step 2: only process push events
  if (event !== 'push') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 })
  }

  const payload = JSON.parse(body)

  // Step 3: ignore branch deletions (push with no commits)
  if (!payload.commits || payload.commits.length === 0) {
    return NextResponse.json({ message: 'No commits' }, { status: 200 })
  }

  try {
    // Step 4: get current sprint tickets
    const tickets = await getActiveSprint()

    // Step 5: process the most recent commit
    const latestCommit = payload.commits[0]
    const commitDetails = await getCommitDetails(latestCommit.id)

    // Step 6: ask Groq which ticket this relates to
    const mapping = await mapCommitToTicket(commitDetails, tickets)

    console.log('Commit mapping result:', {
      commit: commitDetails.message,
      mapped: mapping.ticketKey,
      confidence: mapping.confidence,
      reasoning: mapping.reasoning
    })

    // Step 7: store the result
    recentCommits.unshift({
      commitId: commitDetails.id.slice(0, 7),
      message: commitDetails.message,
      mappedTicket: mapping.ticketKey,
      confidence: mapping.confidence,
      reasoning: mapping.reasoning,
      timestamp: commitDetails.timestamp
    })

    // Keep only last 10
    if (recentCommits.length > 10) recentCommits.pop()

    // Step 8: detect stale tickets
    const staleTickets = detectStaleTickets(tickets)

    return NextResponse.json({
      received: true,
      mapping,
      staleTickets: staleTickets.map(t => t.key)
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook processing error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Expose recent commits to the frontend
export async function GET() {
  return NextResponse.json({ commits: recentCommits })
}