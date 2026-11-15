// Gemini explain helper. First try the built-in server route (/api/explain),
// which uses a key set once in Vercel, so no visitor has to enter a key.
// Fall back to a key entered in the UI, then to the local explainer.
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export const FALLBACK_MICHIGAN =
  'From Michigan, this is a reminder to look up. Clear nights over the Great Lakes are a good time to spot planets, the Moon, and passing asteroids with just your eyes or a small telescope.'

export function localExplainer(title, explanation, dateStr) {
  const clean = (explanation || '').replace(/\s+/g, ' ').trim()
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean]
  const explainer = sentences.slice(0, 3).join(' ').trim() || 'NASA published this image, and its explanation is shown above.'
  return {
    explainer,
    michigan: FALLBACK_MICHIGAN,
    quiz: [
      `What is the main subject of "${title || 'this image'}"?`,
      `This APOD was published on ${dateStr}. In one sentence, what does the NASA explanation say it shows?`,
      'What is one thing in this image you would like to learn more about, and why?',
    ],
    source: 'fallback',
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function explainViaServer({ title, explanation, dateStr }) {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, explanation, dateStr }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || `Explain server returned ${res.status}.`)
  }
  const parsed = await res.json()
  if (!parsed.explainer) throw new Error('Explain server returned no explainer.')
  return {
    explainer: String(parsed.explainer).trim(),
    michigan: parsed.michigan ? String(parsed.michigan).trim() : FALLBACK_MICHIGAN,
    quiz: Array.isArray(parsed.quiz) && parsed.quiz.length
      ? parsed.quiz.slice(0, 3).map(String)
      : localExplainer(title, explanation, dateStr).quiz,
    source: 'gemini',
  }
}

export async function explainWithGemini(apiKey, { title, explanation, dateStr }) {
  const prompt =
    'You are explaining a NASA Astronomy Picture of the Day to a curious beginner. ' +
    `Title: ${title}. Date: ${dateStr}. NASA explanation: ${explanation} ` +
    'Reply with JSON only, no other text. Use this shape: ' +
    '{"explainer": "exactly 3 short sentences in plain English, no jargon", ' +
    '"michigan": "one short sentence about why this matters for someone watching the sky from Michigan", ' +
    '"quiz": ["question 1", "question 2", "question 3"]}. ' +
    'Make the quiz questions check understanding of the explainer.'
  let res = null
  let lastText = ''
  for (const model of GEMINI_MODELS) {
    res = await fetch(`${geminiUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    })
    if (res.ok) break
    lastText = await res.text().catch(() => '')
    if (!lastText.includes('no longer available') && !lastText.includes('not found')) break
  }
  if (!res || !res.ok) {
    throw new Error(`Gemini request failed (${res ? res.status : 'no response'}). ${lastText.slice(0, 140)}`)
  }
  const json = await res.json()
  const text =
    (json.candidates && json.candidates[0] && json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts.map((p) => p.text || '').join('')) || ''
  if (!text.trim()) throw new Error('Gemini returned an empty reply.')
  const parsed = extractJson(text)
  if (parsed && parsed.explainer) {
    return {
      explainer: String(parsed.explainer).trim(),
      michigan: parsed.michigan ? String(parsed.michigan).trim() : FALLBACK_MICHIGAN,
      quiz: Array.isArray(parsed.quiz) && parsed.quiz.length
        ? parsed.quiz.slice(0, 3).map(String)
        : localExplainer(title, explanation, dateStr).quiz,
      source: 'gemini',
    }
  }
  return { explainer: text.trim(), michigan: FALLBACK_MICHIGAN, quiz: localExplainer(title, explanation, dateStr).quiz, source: 'gemini' }
}
