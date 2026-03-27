import { NextRequest, NextResponse } from 'next/server'
import { textToSpeech } from '@/lib/deepgram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 2000) {
      return NextResponse.json({ error: 'Text too long' }, { status: 400 })
    }

    const audioBytes = await textToSpeech(text)

    // Return the audio as binary data with the correct content type
    // The browser needs Content-Type: audio/mpeg to know how to play it
    return new NextResponse(audioBytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBytes.byteLength.toString()
      }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}