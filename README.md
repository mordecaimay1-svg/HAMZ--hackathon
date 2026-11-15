# Nest APOD Explorer

Hack The Nest 2026 entry, built Nov 15, 2026. Pick any Astronomy Picture of the Day, read what NASA says, get a plain English explainer, hear it read aloud, and see the closest asteroids passing Earth today.

Devpost-ready description: Nest APOD Explorer makes NASA space data easy to understand. Browse any APOD date, get a Gemini plain English explainer with a quick quiz, hear it with ElevenLabs voice, and check today's closest near Earth asteroids. Built for anyone curious about space, including skywatchers in Michigan.

## Tracks

- Beyond the Horizon: real NASA APOD and NeoWs data, shown exactly as NASA published it, with dates, credits, and miss distances.
- Best Use of Gemini API: Gemini 2.5 Flash turns the NASA explanation into 3 plain English sentences, a Michigan line, and 3 quiz questions.
- Best Use of ElevenLabs: Listen reads the explainer aloud. With an ElevenLabs key it uses lifelike ElevenLabs TTS. Without a key it falls back to browser voice, so the demo still works.

## Starter credit

Starter: Sanketdinkarmore/Nasa-apod-react-dashboard (MIT-style open source starter), rebuilt and extended at Hack The Nest 2026 on Nov 15 with date browsing, NeoWs, Gemini explain, and ElevenLabs listen added during the event.

## Setup

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually http://localhost:5173.

## Build

```bash
npm run build
npm run preview
```

## Keys

No real keys are in this repo. Do not commit keys.

- NASA: set `VITE_NASA_API_KEY` in a local `.env` file (see `.env.example`). If you skip it, the app uses `DEMO_KEY`, which has a low rate limit. Get a free key at https://api.nasa.gov/
- Gemini: enter the key in the app, in the API keys panel. It is saved only in your browser localStorage. Get a free key at https://aistudio.google.com/
- ElevenLabs: enter the key in the app, in the API keys panel. It is saved only in your browser localStorage. Get a key at https://elevenlabs.io/

Without a Gemini key, Explain shows a local plain English version and tells you to add a key. Without an ElevenLabs key, Listen uses browser voice and tells you which mode is active.

## Demo script (2 minutes)

1. Open the app, show today APOD and the track badges.
2. Pick a past date with the date picker, then Surprise me.
3. Click Explain this in plain English, read the 3 sentences and the Michigan line.
4. Click Listen, hear the explainer read aloud.
5. Scroll to Near Earth objects today, point out the closest asteroid, its miss distance in km, and whether it is potentially hazardous.

## Files

- `src/App.jsx`: date picker, APOD and NeoWs loading, Gemini and ElevenLabs UI
- `src/lib/nasa.js`: APOD and NeoWs calls, per date localStorage cache
- `src/lib/gemini.js`: Gemini 2.5 Flash explain call, plus local fallback
- `src/lib/elevenlabs.js`: ElevenLabs TTS call, plus browser speech fallback
- `src/components/Main.jsx`: APOD image or video display
- `src/components/SideBar.jsx`: full details panel
- `src/components/Footer.jsx`: title bar and details button
