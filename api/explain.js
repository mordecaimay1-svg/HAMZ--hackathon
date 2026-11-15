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
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    )
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      res.status(502).json({ error: `Gemini request failed (${r.status}). ${text.slice(0, 140)}` })
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
