import { DeepgramClient } from '@deepgram/sdk'
import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing DEEPGRAM_API_KEY on the server' },
      { status: 500 }
    )
  }

  try {
    const client = new DeepgramClient({ apiKey })
    const { access_token } = await client.auth.v1.tokens.grant({
      ttl_seconds: 120
    })

    return NextResponse.json({ token: access_token })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
