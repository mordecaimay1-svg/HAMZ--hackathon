// Vercel serverless function: fetch the real APOD for a date from apod.nasa.gov.
// The public NASA APOD API returns a generic placeholder for many dates right
// now, while the APOD website still has the real entries. This runs server-side,
// so it is not blocked by browser CORS. Returns JSON, or 404 if no real APOD
// exists for that date.
export default async function handler(req, res) {
  const date = req.query.date || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' })
    return
  }
  const yy = date.slice(2, 4)
  const mm = date.slice(5, 7)
  const dd = date.slice(8, 10)
  const url = `https://apod.nasa.gov/apod/ap${yy}${mm}${dd}.html`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    if (!r.ok) {
      res.status(404).json({ error: 'no APOD page for that date' })
      return
    }
    const html = await r.text()
    const titleMatch = html.match(/<title>APOD:\s*\d{4}\s+\w+\s+\d+\s+-\s+(.*?)\s+-\s+NASA Science<\/title>/)
    if (!titleMatch) {
      res.status(404).json({ error: 'no real APOD for that date' })
      return
    }
    const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    if (!ogMatch) {
      res.status(404).json({ error: 'no APOD image for that date' })
      return
    }
    const expMatch = html.match(/Explanation:\s*(.*?)<\/p>/s)
    let explanation = ''
    if (expMatch) {
      explanation = expMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      explanation = explanation.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    }
    const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json({
      date,
      title,
      explanation,
      url: ogMatch[1],
      hdurl: ogMatch[1],
      media_type: 'image',
      copyright: 'NASA',
      source: 'apod-website',
    })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
