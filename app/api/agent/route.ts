import { NextRequest, NextResponse } from 'next/server'
import { runAgent, Message } from '@/lib/agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, history = [] } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const result = await runAgent(message, history as Message[])

    return NextResponse.json(result)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}