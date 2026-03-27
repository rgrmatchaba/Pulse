'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface VoiceCommandProps {
  onResponse: (response: string) => void
  onTicketsUpdate: () => void
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

export default function VoiceCommand({
  onResponse,
  onTicketsUpdate
}: VoiceCommandProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [lastResponse, setLastResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('audio/webm')
  const processTranscriptRef = useRef<
    (text: string) => void | Promise<void>
  >(() => {})

  // Speak a response using our TTS endpoint from Stage 3
  const speak = useCallback(async (text: string) => {
    setState('speaking')
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!res.ok) throw new Error('TTS failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      audio.onended = () => {
        setState('idle')
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => setState('idle')
      await audio.play()
    } catch {
      setState('idle')
    }
  }, [])

  // Send transcript to Groq agent
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) {
      setState('idle')
      return
    }

    setState('processing')
    setError(null)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!res.ok) throw new Error('Agent request failed')

      const data = await res.json()
      setLastResponse(data.response)
      onResponse(data.response)

      // If agent touched Jira, refresh the sprint board
      onTicketsUpdate()

      // Speak the confirmation back
      await speak(data.response)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setState('idle')
    }
  }, [speak, onResponse, onTicketsUpdate])

  useEffect(() => {
    processTranscriptRef.current = processTranscript
  }, [processTranscript])

  const startListening = useCallback(async () => {
    setError(null)
    setTranscript('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      if (!mimeType) {
        setError('Recording not supported in this browser')
        return
      }

      chunksRef.current = []
      mimeTypeRef.current = mimeType

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())

        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current
        })
        chunksRef.current = []
        mediaRecorderRef.current = null

        if (blob.size === 0) {
          setState('idle')
          return
        }

        void (async () => {
          setState('processing')
          try {
            const res = await fetch('/api/deepgram/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': blob.type || 'audio/webm' },
              body: blob
            })

            const raw = await res.text()
            let data: { error?: string; transcript?: string } = {}
            if (raw) {
              try {
                data = JSON.parse(raw) as { error?: string; transcript?: string }
              } catch {
                throw new Error(
                  raw.startsWith('<!DOCTYPE')
                    ? 'Server returned an auth/HTML page instead of JSON'
                    : 'Server returned invalid JSON'
                )
              }
            }

            if (!res.ok) {
              throw new Error(
                typeof data.error === 'string'
                  ? data.error
                  : `Transcription failed (${res.status})`
              )
            }

            const text = (data.transcript as string) ?? ''
            setTranscript(text)
            await processTranscriptRef.current(text)
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : 'Transcription failed'
            setError(message)
            setState('idle')
          }
        })()
      }

      mediaRecorder.start(250)
      setState('listening')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Microphone access denied'
      setError(message)
      setState('idle')
    }
  }, [])

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const stateConfig = {
    idle: {
      label: 'Hold to speak',
      icon: '🎤',
      bg: 'bg-zinc-800 hover:bg-zinc-700',
      ring: ''
    },
    listening: {
      label: 'Listening...',
      icon: '🔴',
      bg: 'bg-red-500/20',
      ring: 'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-950'
    },
    processing: {
      label: 'Thinking...',
      icon: '⚡',
      bg: 'bg-yellow-500/20',
      ring: ''
    },
    speaking: {
      label: 'Speaking...',
      icon: '🔊',
      bg: 'bg-green-500/20',
      ring: ''
    }
  }

  const config = stateConfig[state]

  return (
    <div className="flex flex-col items-center gap-4">

      {/* Transcript display */}
      {transcript && (
        <div className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">You said:</p>
          <p className="text-sm text-zinc-100">{transcript}</p>
        </div>
      )}

      {/* Last response */}
      {lastResponse && (
        <div className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">Pulse:</p>
          <p className="text-sm text-zinc-300">{lastResponse}</p>
        </div>
      )}

      {/* Mic button — hold to speak */}
      <button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        disabled={state === 'processing' || state === 'speaking'}
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          text-2xl transition-all duration-150 select-none
          ${config.bg} ${config.ring}
          ${state === 'processing' || state === 'speaking'
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer active:scale-95'
          }
        `}
      >
        {config.icon}
      </button>

      <p className="text-xs text-zinc-500">{config.label}</p>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

    </div>
  )
}
