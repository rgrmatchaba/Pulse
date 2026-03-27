'use client'

import { useState } from 'react'

interface PulseVoiceProps {
  text: string
  autoPlay?: boolean
}

export default function PulseVoice({ text, autoPlay = false }: PulseVoiceProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const speak = async (textToSpeak: string) => {
    if (isSpeaking) return
    setIsSpeaking(true)
    setError(null)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak })
      })

      if (!response.ok) throw new Error('TTS request failed')

      // Convert the raw audio bytes into a blob the browser understands
      const audioBlob = await response.blob()

      // Create a temporary local URL pointing to that blob
      const audioUrl = URL.createObjectURL(audioBlob)

      // Create an Audio element and play it
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        setIsSpeaking(false)
        // Clean up the blob URL after playing — avoids memory leaks
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        setError('Failed to play audio')
      }

      await audio.play()

    } catch (err) {
      setIsSpeaking(false)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => speak(text)}
        disabled={isSpeaking}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          transition-all duration-200
          ${isSpeaking
            ? 'bg-green-500 text-white animate-pulse cursor-not-allowed'
            : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 cursor-pointer'
          }
        `}
      >
        {isSpeaking ? (
          <>
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
            Speaking...
          </>
        ) : (
          <>
            🔊 Hear Sprint Brief
          </>
        )}
      </button>
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  )
}