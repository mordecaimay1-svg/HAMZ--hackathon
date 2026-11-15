// Vercel serverless function: ElevenLabs voice, with the key kept server-side.
// The browser never needs a key. Set ELEVENLABS_API_KEY in Vercel env vars once,
// and every visitor gets the lifelike voice with no key entry. If no key is set,
// this returns 501 and the app uses browser voice instead.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    res.status(501).json({ error: 'ELEVENLABS_API_KEY is not set in Vercel yet' })
    return
  }
  const { text, voiceId } = req.body || {}
  if (!text) {
    res.status(400).json({ error: 'text is required' })
    return
  }
  const voice = voiceId || '21m00Tcm4TlvDq8ikWAM'
  // Free tier fix: use the cheapest Flash model, the lowest MP3 output
  // format, and only the first 900 characters. The previous settings
  // (Turbo model, 44.1 kHz 128 kbps, up to 4,000 chars) were refused with
  // 402 Payment Required on the Free plan.
  const shortText = String(text).slice(0, 900)
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          text: shortText,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      res.status(502).json({ error: `ElevenLabs request failed (${r.status}). ${detail.slice(0, 140)}` })
      return
    }
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(buf)
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
