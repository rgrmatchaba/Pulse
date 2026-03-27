import { DeepgramClient } from '@deepgram/sdk'

// Deepgram SDK v5 uses `DeepgramClient` (no `createClient` export).
const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! })

/** Pre-recorded STT (works with standard project API keys; no /v1/auth/grant). */
export async function transcribeAudioBuffer(
  buffer: Buffer,
  contentType = 'audio/webm'
): Promise<string> {
  const result = await deepgram.listen.v1.media.transcribeFile(
    { data: buffer, contentType },
    {
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      punctuate: true,
    }
  )

  if (!('results' in result) || !result.results) {
    throw new Error('Unexpected async transcription response; expected sync results')
  }

  return (
    result.results.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
  )
}

export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const response = await deepgram.speak.v1.audio.generate({
    text,
    model: 'aura-asteria-en', // Deepgram's best free voice
    encoding: 'mp3',
  })

  const audioArrayBuffer = await response.arrayBuffer()
  // Deepgram returns ArrayBufferLike; cast to ArrayBuffer for NextResponse BodyInit typing.
  return audioArrayBuffer as ArrayBuffer
}