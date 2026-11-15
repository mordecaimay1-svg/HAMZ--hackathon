// NASA API helpers. No keys are stored here. The NASA key comes from
// VITE_NASA_API_KEY at build time and defaults to DEMO_KEY.
import { fallbackForDate, isPlaceholderAPOD } from './fallback'
const NASA_KEY = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY'
const NASA_BASE = 'https://api.nasa.gov'

export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function randomAPODDate() {
  const start = new Date('1995-06-16T00:00:00').getTime()
  const end = Date.now()
  const pick = new Date(start + Math.random() * (end - start))
  const off = pick.getTimezoneOffset()
  return new Date(pick.getTime() - off * 60000).toISOString().slice(0, 10)
}

export async function fetchAPOD(dateStr) {
  const cacheKey = `NASA-APOD-${dateStr}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const parsed = JSON.parse(cached)
    if (isPlaceholderAPOD(parsed)) {
      const fallback = fallbackForDate(dateStr)
      localStorage.setItem(cacheKey, JSON.stringify(fallback))
      return { data: fallback, fromCache: true }
    }
    const cachedUrl = parsed.url || parsed.hdurl || ''
    if (parsed.fallback && (cachedUrl.includes('~large') || cachedUrl.includes('~medium'))) {
      const fallback = fallbackForDate(dateStr)
      localStorage.setItem(cacheKey, JSON.stringify(fallback))
      return { data: fallback, fromCache: true }
    }
    return { data: parsed, fromCache: true }
  }
  const url = `${NASA_BASE}/planetary/apod?api_key=${NASA_KEY}&date=${dateStr}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`NASA APOD request failed (${res.status}). ${text.slice(0, 120)}`)
  }
  const data = await res.json()
  if (data.code || data.error) {
    throw new Error(data.msg || data.error?.message || 'NASA APOD returned an error.')
  }
  if (isPlaceholderAPOD(data)) {
    const fallback = fallbackForDate(dateStr)
    localStorage.setItem(cacheKey, JSON.stringify(fallback))
    return { data: fallback, fromCache: false }
  }
  localStorage.setItem(cacheKey, JSON.stringify(data))
  return { data, fromCache: false }
}

export async function fetchNEOToday() {
  const today = todayISO()
  const cacheKey = `NASA-NEO-${today}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    return { list: JSON.parse(cached), fromCache: true, date: today }
  }
  const url = `${NASA_BASE}/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${NASA_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`NASA NeoWs request failed (${res.status}). Try again in a minute.`)
  }
  const json = await res.json()
  const raw = (json.near_earth_objects && json.near_earth_objects[today]) || []
  const list = raw
    .map((o) => {
      const approach = (o.close_approach_data && o.close_approach_data[0]) || {}
      const missKm = Number(approach.miss_distance && approach.miss_distance.kilometers)
      const diam = o.estimated_diameter && o.estimated_diameter.kilometers
      return {
        id: o.id,
        name: o.name,
        hazardous: Boolean(o.is_potentially_hazardous_asteroid),
        missKm: Number.isFinite(missKm) ? missKm : null,
        missLunar: approach.miss_distance ? Number(approach.miss_distance.lunar) : null,
        velocityKmh: approach.relative_velocity
          ? Number(approach.relative_velocity.kilometers_per_hour)
          : null,
        diameterMinKm: diam ? diam.estimated_diameter_min : null,
        diameterMaxKm: diam ? diam.estimated_diameter_max : null,
        approachDate: approach.close_approach_date_full || approach.close_approach_date || today,
      }
    })
    .filter((o) => o.missKm !== null)
    .sort((a, b) => a.missKm - b.missKm)
    .slice(0, 5)
  localStorage.setItem(cacheKey, JSON.stringify(list))
  return { list, fromCache: false, date: today }
}

export function formatKm(km) {
  if (km === null || km === undefined || !Number.isFinite(km)) return 'Unknown'
  return `${Math.round(km).toLocaleString('en-US')} km`
}
