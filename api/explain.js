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
  // Google now limits the 2.5 models (and 1.5 / 2.0) to projects that used
  // them before, and the models list still lists them even though
  // generateContent 404s for a new key. The current text models for a new
  // key are the 3.x Flash family. Try those first, in order.
  // Docs: ai.google.dev/gemini-api/docs/models - 2.5-flash routes to
  // 3.5-flash-lite from Dec 1, 2026, and new projects should use 3.5-flash-lite.
  const PREFERRED_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ]
  const NON_TEXT = ['tts', 'image', 'live', 'transcribe', 'omni', 'embedding', 'audio', 'video', 'banana']
  const isTextModel = (name) => !NON_TEXT.some((t) => name.includes(t))
  let models = [...PREFERRED_MODELS]
  try {
    const listR = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`
    )
    if (listR.ok) {
      const listJ = await listR.json()
      const usable = (listJ.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => String(m.name || '').replace('models/', ''))
        .filter((name) => name && isTextModel(name))
      // Preferred models first (even if the list missed one, try it anyway),
      // then any other text model the list returned. Never let the list
      // push a TTS / image / live model to the front.
      const rest = usable.filter((u) => !PREFERRED_MODELS.includes(u))
      if (usable.length) models = [...PREFERRED_MODELS, ...rest]
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
            generationConfig: { temperature: 0.4, maxOutputTokens: 1000 },
          }),
        }
      )
      if (r.ok) break
      lastError = await r.text().catch(() => '')
      // Only stop trying other models when the key itself is rejected.
      // A 404 (model not available to this key), a 400 (model does not
      // support plain text), or a rate limit just means try the next model.
      if (r.status === 401 || r.status === 403) break
    }
    if (!r || !r.ok) {
      res.status(502).json({ error: `Gemini request failed (${r ? r.status : 'no response'}) after trying ${models.length} models. ${String(lastError).slice(0, 200)}` })
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
    // Gemini did not return JSON. Take the first 3 plain sentences before
    // any quiz section, instead of returning the raw reply (which can start
    // mid-quiz).
    const beforeQuiz = text.split(/quiz/i)[0]
    const clean = beforeQuiz.replace(/```[\s\S]*?```/g, '').replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim()
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean]
    const explainer = sentences.slice(0, 3).join(' ').trim() || clean
    const quizMatches = [...text.matchAll(/(?:Q\d+[:.)]|^\s*\d+[.)])\s*(.+)/gm)].map((m) => m[1].trim()).filter(Boolean).slice(0, 3)
    res.status(200).json({ explainer, michigan: 'From Michigan, this is a reminder to look up. Clear nights over the Great Lakes are a good time to spot planets, the Moon, and passing asteroids with just your eyes or a small telescope.', quiz: quizMatches.length ? quizMatches : undefined, source: 'gemini' })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
