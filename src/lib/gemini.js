// Gemini explain helper. The API key is entered in the UI and kept only in
// localStorage. It is never committed and never sent anywhere except Google.
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

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

export async function explainWithGemini(apiKey, { title, explanation, dateStr }) {
  const prompt =
    'You are explaining a NASA Astronomy Picture of the Day to a curious beginner. ' +
    `Title: ${title}. Date: ${dateStr}. NASA explanation: ${explanation} ` +
    'Reply with JSON only, no other text. Use this shape: ' +
    '{"explainer": "exactly 3 short sentences in plain English, no jargon", ' +
    '"michigan": "one short sentence about why this matters for someone watching the sky from Michigan", ' +
    '"quiz": ["question 1", "question 2", "question 3"]}. ' +
    'Make the quiz questions check understanding of the explainer.'
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini request failed (${res.status}). ${text.slice(0, 140)}`)
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
