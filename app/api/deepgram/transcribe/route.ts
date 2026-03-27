import { DeepgramError } from '@deepgram/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioBuffer } from '@/lib/deepgram'

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const buf = Buffer.from(await request.arrayBuffer())
    if (buf.length === 0) {
      return NextResponse.json({ error: 'Empty audio' }, { status: 400 })
    }
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio too large' }, { status: 400 })
    }

    const contentType =
      request.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/webm'

    const transcript = await transcribeAudioBuffer(buf, contentType)

    return NextResponse.json({ transcript })
  } catch (error) {
    if (error instanceof DeepgramError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode ?? 500 }
      )
    }
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
