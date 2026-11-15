// Vercel serverless function: Gemini explain, with the key kept server-side.
// The browser never needs a key. Set GEMINI_API_KEY in Vercel env vars once,
// and every visitor gets the AI explainer with no key entry. If no key is set,
// this returns 501 and the app uses its local plain English version instead.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    res.status(501).json({ error: 'GEMINI_API_KEY is not set in Vercel yet' })
    return
  }
  const { title, explanation, dateStr } = req.body || {}
  if (!title || !explanation) {
    res.status(400).json({ error: 'title and explanation are required' })
    return
  }
  const prompt =
    'You are explaining a NASA Astronomy Picture of the Day to a curious beginner. ' +
    `Title: ${title}. Date: ${dateStr || ''}. NASA explanation: ${String(explanation).slice(0, 3000)} ` +
    'Reply with JSON only, no other text. Use this shape: ' +
    '{"explainer": "exactly 3 short sentences in plain English, no jargon", ' +
    '"michigan": "one short sentence about why this matters for someone watching the sky from Michigan", ' +
    '"quiz": ["question 1", "question 2", "question 3"]}. ' +
    'Make the quiz questions check understanding of the explainer.'
  // Model names change and new keys do not get every model, so list the
  // models this key can actually use, then try them in order.
  let models = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']
  try {
    const listR = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`
    )
    if (listR.ok) {
      const listJ = await listR.json()
      const usable = (listJ.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => String(m.name || '').replace('models/', ''))
        .filter(Boolean)
      const preferred = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']
      const ordered = preferred.filter((p) => usable.includes(p))
      // Only use exact preferred text models. Other listed models are often
      // image, audio, or live models that do not support plain TEXT output.
      if (ordered.length) models = ordered
    }
  } catch (e) {}
  let r = null
  let lastError = ''
  try {
    for (const model of models) {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
          }),
        }
      )
      if (r.ok) break
      lastError = await r.text().catch(() => '')
      if (!lastError.includes('no longer available') && !lastError.includes('not found')) break
    }
    if (!r || !r.ok) {
      res.status(502).json({ error: `Gemini request failed (${r ? r.status : 'no response'}). Tried: ${models.join(', ')}. ${String(lastError).slice(0, 400)}` })
      return
    }
    const json = await r.json()
    const text =
      (json.candidates && json.candidates[0] && json.candidates[0].content &&
        json.candidates[0].content.parts &&
        json.candidates[0].content.parts.map((p) => p.text || '').join('')) || ''
    if (!text.trim()) {
      res.status(502).json({ error: 'Gemini returned an empty reply.' })
      return
    }
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const raw = fenced ? fenced[1] : text
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1))
        if (parsed.explainer) {
          res.status(200).json({ ...parsed, source: 'gemini' })
          return
        }
      } catch (e) {}
    }
    res.status(200).json({ explainer: text.trim(), source: 'gemini' })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
