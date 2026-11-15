// ElevenLabs TTS helper, plus a browser speech fallback so the demo
// always works. First try the built-in server route (/api/listen), which
// uses a key set once in Vercel, so no visitor has to enter a key.
// Fall back to a key entered in the UI, then to browser voice.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) {
    throw new Error('Browser speech is not available in this browser.')
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
  return 'browser'
}

export function stopBrowserSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function speakViaServer(text, voiceId = DEFAULT_VOICE_ID) {
  const res = await fetch('/api/listen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 4000), voiceId }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || `Listen server returned ${res.status}.`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function speakWithElevenLabs(apiKey, text, voiceId = DEFAULT_VOICE_ID) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.slice(0, 900),
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ElevenLabs request failed (${res.status}). ${detail.slice(0, 140)}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
