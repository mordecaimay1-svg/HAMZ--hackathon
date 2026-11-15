import React, { useCallback, useEffect, useRef, useState } from 'react'
import SideBar from './components/SideBar'
import Main from './components/Main'
import Footer from './components/Footer'
import Starfield from './components/Starfield'
import { fetchAPOD, fetchNEOToday, formatKm, randomAPODDate, todayISO, NEWEST_REAL_APOD_DATE } from './lib/nasa'
import { explainWithGemini, explainViaServer, localExplainer } from './lib/gemini'
import { speakWithBrowser, speakWithElevenLabs, speakViaServer, stopBrowserSpeech } from './lib/elevenlabs'

const GEMINI_KEY_STORE = 'nest-gemini-key'
const ELEVEN_KEY_STORE = 'nest-elevenlabs-key'

const App = () => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apodError, setApodError] = useState('')
  const [fromCache, setFromCache] = useState(false)

  const [neoList, setNeoList] = useState([])
  const [neoLoading, setNeoLoading] = useState(false)
  const [neoError, setNeoError] = useState('')
  const [neoDate, setNeoDate] = useState(todayISO())

  const [showModal, setShowModal] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORE) || '')
  const [elevenKey, setElevenKey] = useState(() => localStorage.getItem(ELEVEN_KEY_STORE) || '')
  const [geminiDraft, setGeminiDraft] = useState('')
  const [elevenDraft, setElevenDraft] = useState('')
  const [keySaved, setKeySaved] = useState('')

  const [geminiResult, setGeminiResult] = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiError, setGeminiError] = useState('')

  const [audioMode, setAudioMode] = useState('idle')
  const [audioError, setAudioError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const audioRef = useRef(null)

  function handleToggleModal() {
    setShowModal(!showModal)
  }

  const loadAPOD = useCallback(async (dateStr) => {
    setLoading(true)
    setApodError('')
    setGeminiResult(null)
    setGeminiError('')
    try {
      const { data: apidata, fromCache: cached } = await fetchAPOD(dateStr)
      setData(apidata)
      setFromCache(cached)
    } catch (err) {
      setData(null)
      setApodError(err.message || 'Could not load this APOD date. Try another date.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadNEO = useCallback(async () => {
    setNeoLoading(true)
    setNeoError('')
    try {
      const { list, date } = await fetchNEOToday()
      setNeoList(list)
      setNeoDate(date)
    } catch (err) {
      setNeoList([])
      setNeoError(err.message || 'Could not load near Earth objects right now.')
    } finally {
      setNeoLoading(false)
    }
  }, [])

  useEffect(() => { loadAPOD(selectedDate) }, [selectedDate, loadAPOD])
  useEffect(() => { loadNEO() }, [loadNEO])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      stopBrowserSpeech()
    }
  }, [audioUrl])

  function pickDate(value) {
    if (!value) return
    if (value < '1995-06-16') return
    if (value > todayISO()) return
    setSelectedDate(value)
  }

  function stepDay(delta) {
    const d = new Date(`${selectedDate}T12:00:00`)
    d.setDate(d.getDate() + delta)
    pickDate(d.toISOString().slice(0, 10))
  }

  function saveKeys() {
    const g = geminiDraft.trim()
    const e = elevenDraft.trim()
    if (g) { localStorage.setItem(GEMINI_KEY_STORE, g); setGeminiKey(g) }
    if (e) { localStorage.setItem(ELEVEN_KEY_STORE, e); setElevenKey(e) }
    setGeminiDraft('')
    setElevenDraft('')
    setKeySaved('Keys saved in this browser only. They are never sent to our server or committed to GitHub.')
    setTimeout(() => setKeySaved(''), 5000)
  }

  function clearKeys() {
    localStorage.removeItem(GEMINI_KEY_STORE)
    localStorage.removeItem(ELEVEN_KEY_STORE)
    setGeminiKey('')
    setElevenKey('')
    setGeminiResult(null)
    setKeySaved('Keys cleared from this browser.')
    setTimeout(() => setKeySaved(''), 5000)
  }

  async function handleExplain() {
    if (!data) return
    setGeminiLoading(true)
    setGeminiError('')
    try {
      try {
        const result = await explainViaServer({
          title: data.title, explanation: data.explanation, dateStr: data.date,
        })
        setGeminiResult(result)
      } catch (serverErr) {
        if (geminiKey) {
          const result = await explainWithGemini(geminiKey, {
            title: data.title, explanation: data.explanation, dateStr: data.date,
          })
          setGeminiResult(result)
        } else {
          setGeminiResult(localExplainer(data.title, data.explanation, data.date))
          setGeminiError('AI explain is not set up on the server yet, so this is a local plain English version. It still works with no key to enter.')
        }
      }
    } catch (err) {
      setGeminiResult(localExplainer(data.title, data.explanation, data.date))
      setGeminiError(`Gemini call failed, showing the local version instead. ${err.message}`)
    } finally {
      setGeminiLoading(false)
    }
  }

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    stopBrowserSpeech()
    setAudioMode('idle')
  }

  async function handleListen() {
    const text = geminiResult
      ? `${geminiResult.explainer} ${geminiResult.michigan}`
      : (data ? `${data.title}. ${data.explanation}` : '')
    if (!text) return
    setAudioError('')
    stopAudio()
    setAudioMode('loading')
    try {
      const url = await speakViaServer(text)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(url)
      setAudioMode('elevenlabs')
      return
    } catch (serverErr) {
      if (elevenKey) {
        try {
          const url = await speakWithElevenLabs(elevenKey, text)
          if (audioUrl) URL.revokeObjectURL(audioUrl)
          setAudioUrl(url)
          setAudioMode('elevenlabs')
          return
        } catch (err) {
          setAudioError(`ElevenLabs call failed, using browser voice instead. ${err.message}`)
        }
      }
    }
    try {
      speakWithBrowser(text)
      setAudioMode('browser')
      setAudioError('Lifelike voice is not set up on the server yet, so this is browser voice. It still works with no key to enter.')
    } catch (err) {
      setAudioError(err.message)
      setAudioMode('idle')
    }
  }

  const voiceLabel = audioMode === 'elevenlabs'
    ? 'ElevenLabs voice active'
    : 'Browser voice active (lifelike voice is set up on the server when a key is added in Vercel)'

  return (
    <div className="appShell">
      <Starfield />
      <header className="appHeader">
        <div>
          <h1><span className="titleStar">✦</span> Nest APOD Explorer</h1>
          <p>Today in space, explained in plain English and read aloud.</p>
        </div>
        <div className="badgeRow" aria-label="Hackathon tracks">
          <span className="badge">Beyond the Horizon</span>
          <span className="badge">Gemini API</span>
          <span className="badge">ElevenLabs</span>
        </div>
      </header>

      <main className="content">
        <section className="panel controls" aria-label="Pick a date">
          <div className="controlRow">
            <label htmlFor="apod-date">Pick a date</label>
            <input
              id="apod-date"
              type="date"
              min="1995-06-16"
              max={todayISO()}
              value={selectedDate}
              onChange={(e) => pickDate(e.target.value)}
            />
            <button className="btn" type="button" onClick={() => setSelectedDate(todayISO())}>Today</button>
            <button className="btn" type="button" onClick={() => setSelectedDate(NEWEST_REAL_APOD_DATE)}>Newest real APOD</button>
            <button className="btn" type="button" onClick={() => setSelectedDate(randomAPODDate())}>Surprise me</button>
            <button className="btn" type="button" onClick={() => stepDay(-1)} aria-label="Previous day">Prev</button>
            <button className="btn" type="button" onClick={() => stepDay(1)} aria-label="Next day">Next</button>
          </div>
          <p className="hint">APOD started June 16, 1995. Pick any past date. Visited dates are cached in your browser.</p>
        </section>

        {loading && (
          <div className="loadingSky" role="status">
            <div className="loadingOrbit">
              <span className="loadingPlanet">🌍</span>
              <span className="loadingMoon">🌙</span>
            </div>
            <p className="loadingTitle">Loading the sky for {selectedDate}...</p>
            <p className="loadingSub">Fetching the picture, the story, and today's asteroids from NASA.</p>
            <div className="loadingBar"><span /></div>
            <div className="skeletonGrid">
              <div className="skeletonHero" />
              <div className="skeletonLine" />
              <div className="skeletonLine skeletonShort" />
            </div>
          </div>
        )}

        {apodError && !loading && (
          <section className="panel errorPanel" role="alert">
            <h2>Could not load that date</h2>
            <p>{apodError}</p>
            <p>Check the date, then try Today. NASA DEMO_KEY has a low rate limit, so a free NASA key helps.</p>
            <button className="btn btnPrimary" type="button" onClick={() => loadAPOD(selectedDate)}>Try again</button>
          </section>
        )}

        {data && !loading && (
          <>
            <div className="heroWrap">
              <Main data={data} />
              <div className="heroCaption">
                <h2>{data.title}</h2>
                <p>{data.date} {data.copyright ? `| Credit: ${data.copyright}` : ''} {fromCache ? '| Loaded from browser cache' : '| Fresh from NASA'}</p>
              </div>
            </div>

            {data.fallback && (
              <p className="panel notePanel" role="note">{data.fallbackNote} Featured image for {data.date}: {data.title}.</p>
            )}
            {data.source && (data.source === 'apod-archive' || data.source === 'apod-website') && (
              <p className="panel notePanel" role="note">Real APOD for {data.date}, fetched from the NASA APOD website because the APOD API is returning a placeholder right now. Newest real APOD we verified is {NEWEST_REAL_APOD_DATE}.</p>
            )}

            <section className="panel" aria-label="NASA explanation">
              <h2>{data.fallback ? 'About this featured image' : 'What NASA says'}</h2>
              <p>{data.explanation}</p>
              <p className="sourceLine">Source: {data.fallback ? 'NASA Image Library' : `NASA Astronomy Picture of the Day, ${data.date}`}. Data shown exactly as NASA published it.</p>
              <div className="buttonRow">
                <button className="btn btnPrimary" type="button" onClick={handleExplain} disabled={geminiLoading}>
                  {geminiLoading ? 'Explaining...' : 'Explain this in plain English'}
                </button>
                <button className="btn" type="button" onClick={handleListen} disabled={audioMode === 'loading'}>
                  {audioMode === 'loading' ? 'Making audio...' : 'Listen'}
                </button>
                {audioMode !== 'idle' && audioMode !== 'loading' && (
                  <button className="btn" type="button" onClick={stopAudio}>Stop audio</button>
                )}
                <button className="btn" type="button" onClick={handleToggleModal}>Full details</button>
              </div>
              <p className="hint">Voice mode: {voiceLabel}.</p>
              {audioUrl && audioMode === 'elevenlabs' && (
                <audio ref={audioRef} src={audioUrl} controls autoPlay className="audioPlayer" />
              )}
              {audioError && <p className="note">{audioError}</p>}
            </section>

            {geminiError && <p className="panel notePanel">{geminiError}</p>}

            {geminiResult && (
              <section className="panel" aria-label="Plain English explainer">
                <h2>Plain English {geminiResult.source === 'gemini' ? '(by Gemini)' : '(local version)'}</h2>
                <p>{geminiResult.explainer}</p>
                <h3>Why it matters in Michigan</h3>
                <p>{geminiResult.michigan}</p>
                <h3>Quick quiz</h3>
                <ol className="quizList">
                  {geminiResult.quiz.map((q, i) => <li key={i}>{q}</li>)}
                </ol>
                {geminiResult.source !== 'gemini' && (
                  <p className="note">AI explain runs through the server when a Gemini key is set once in Vercel. Get a free key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.</p>
                )}
              </section>
            )}

            <section className="panel" aria-label="Near Earth objects today">
              <h2>Near Earth objects today ({neoDate})</h2>
              <p>Closest 5 asteroids passing Earth today, from NASA NeoWs. Distances are miss distances, not impact distances.</p>
              {neoLoading && <p>Loading asteroids...</p>}
              {neoError && <p className="note">{neoError}</p>}
              {!neoLoading && !neoError && neoList.length === 0 && <p>No close approach data for today yet. Try again later.</p>}
              <div className="neoGrid">
                {neoList.map((o) => (
                  <article key={o.id} className="neoCard">
                    <h3>{o.name}</h3>
                    <p><strong>Miss distance:</strong> {formatKm(o.missKm)}</p>
                    <p><strong>Size:</strong> {o.diameterMinKm !== null ? `${o.diameterMinKm.toFixed(2)} to ${o.diameterMaxKm.toFixed(2)} km across` : 'Unknown'}</p>
                    <p><strong>Speed:</strong> {o.velocityKmh !== null ? `${Math.round(o.velocityKmh).toLocaleString('en-US')} km/h` : 'Unknown'}</p>
                    <p><strong>Potentially hazardous:</strong> {o.hazardous ? 'Yes' : 'No'}</p>
                    <p className="hint">Closest approach: {o.approachDate}</p>
                  </article>
                ))}
              </div>
              <button className="btn" type="button" onClick={loadNEO} disabled={neoLoading}>Refresh asteroids</button>
            </section>

            <section className="panel" aria-label="How AI and voice work">
              <h2>No keys to enter</h2>
              <p>Explain and Listen work with no key to enter. They run through this app's own server routes, with keys set once in Vercel. Until those server keys are added, Explain uses a local plain English version and Listen uses browser voice, so the demo always works.</p>
              <p className="hint">Server keys, set once in Vercel env vars, never in code: GEMINI_API_KEY, ELEVENLABS_API_KEY.</p>
              {showKeys && (
                <div className="keyForm">
                  <p className="note">Advanced, only if you want to override the server with your own keys in this browser:</p>
                  <label htmlFor="gemini-key">Gemini API key</label>
                  <input id="gemini-key" type="password" autoComplete="off" placeholder="Paste Gemini key, or leave blank" value={geminiDraft} onChange={(e) => setGeminiDraft(e.target.value)} />
                  <label htmlFor="eleven-key">ElevenLabs API key</label>
                  <input id="eleven-key" type="password" autoComplete="off" placeholder="Paste ElevenLabs key, or leave blank" value={elevenDraft} onChange={(e) => setElevenDraft(e.target.value)} />
                  <div className="buttonRow">
                    <button className="btn btnPrimary" type="button" onClick={saveKeys}>Save keys in this browser</button>
                    <button className="btn" type="button" onClick={clearKeys}>Clear keys</button>
                  </div>
                  {keySaved && <p className="note">{keySaved}</p>}
                </div>
              )}
              <button className="btn" type="button" onClick={() => setShowKeys(!showKeys)}>{showKeys ? 'Hide advanced key override' : 'Advanced: use my own keys instead'}</button>
            </section>
          </>
        )}
      </main>

      {showModal && data && (<SideBar handleToggleModal={handleToggleModal} data={data} />)}
      {data && (<Footer handleToggleModal={handleToggleModal} data={data} />)}
    </div>
  )
}

export default App
