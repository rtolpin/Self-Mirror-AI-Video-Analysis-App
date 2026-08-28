<div align="center">

# 🪞 Self-Mirror AI Video Analysis App

**Record yourself. Get an honest AI read. Meet your AI Twin. See yourself in 50+ styles.**

### 🚀 [**Open The Live App →** self-mirror-app-production.up.railway.app](https://self-mirror-app-production.up.railway.app)

[![Live App](https://img.shields.io/badge/Live%20App-self--mirror--app--production.up.railway.app-brightgreen?style=for-the-badge&logo=railway&logoColor=white)](https://self-mirror-app-production.up.railway.app)

[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Express](https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Claude](https://img.shields.io/badge/Claude-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=flat-square)](https://elevenlabs.io)
[![HeyGen](https://img.shields.io/badge/HeyGen-1A56DB?style=flat-square)](https://www.heygen.com)
[![Railway](https://img.shields.io/badge/Deployed_on-Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)

</div>

---

A personal self-reflection tool: record yourself for a specific context (a date, a job interview, a presentation), get an honest AI read on how you came across, build an **AI Twin** of your personality and speech patterns, hear or watch yourself say things in different registers, and ask your twin how you'd likely react to a situation.

## 🧭 How to use it

1. Open the [live app](https://self-mirror-app-production.up.railway.app) and click **Continue As Guest** — no signup, every feature works immediately. (Click **Create Account To Save** in the header any time to turn your guest session into a permanent account.)
2. Click **New Session**, pick or type what you're preparing for, and record a short clip of yourself.
3. Once it saves, your **Honest Analysis** appears automatically — no button to press. Read the critique: sentiment, a confidence score, body-language notes, and concrete strengths/growth areas.
4. Scroll down to **Try Different Versions Of You** and tap any of the 50+ style chips — the same thing you said, rewritten in that register, narrated in your own voice (and rendered as a full synthetic video) if you've set those up in **My Twin**.
5. After a session or two, open the **My Twin** tab — your personality profile builds itself automatically; there's nothing to click.
6. Explore **Life Paths** for AI-suggested professions/cities/activities based on your twin, or use **Ask My Twin** to predict how you'd react to any situation you describe.

## ✨ What it does

### 🎥 Honest Analysis
- Choose an occasion (search presets like "job interview" or type your own), record a short webcam clip in the browser (`MediaRecorder` + `getUserMedia`), and it's transcribed automatically, server-side, by ElevenLabs' speech-to-text — deliberately not the browser's built-in `SpeechRecognition` API, whose support is inconsistent (Firefox doesn't implement it at all, Safari's is unreliable).
- The moment a recording finishes saving, Claude (with vision) reviews a handful of extracted frames alongside the transcript and returns a structured critique, shown under the **"Honest Analysis"** heading on the session page: overall sentiment, a 1–10 confidence score, body-language notes, concrete strengths, concrete growth areas, and a note on fit for the occasion — no separate "Analyze" click required.

### 🎭 Try Different Versions Of You
This is the app's centerpiece — it lives directly under Honest Analysis on the same session page, so it's the very next thing you see after reading your critique.
- Rewrites your actual transcript into 50+ named styles, each backed by its own instruction sent to Claude — dial personality traits up or down (More/Less Confident, More Aggressive, Self-Aware, Vulnerable...), try on professional personas (Consultant, Big Boss, Manager, Intern...), or shift along communication-style axes grounded in real linguistics research rather than stereotypes (see the note below). Tap any chip and the rewrite appears in a few seconds.
- **Two tiers of video, generated automatically, in order of speed:** if you've cloned your voice (in **My Twin**), the rewritten text is synthesized and muxed onto your original footage as new audio (fast — a few seconds, via `ffmpeg`) so there's something real to watch immediately. If you've also unlocked a video avatar, a fully synthetic re-render kicks off in the background at the same time; HeyGen's rendering typically takes several minutes, so the fast dub stays visible with a live "still rendering" indicator and is automatically swapped out for the synthetic version the moment it finishes — no polling or refreshing needed on your end.

### 🧬 AI Twin
- Claude synthesizes a personality/speech profile from everything you've recorded so far: core traits, recurring phrases, thought-process style, values, and communication tendencies.
- The build used to only trigger if you visited the "My Twin" tab and clicked a button. It now fires automatically the moment you have at least one recorded session and no profile yet, triggered once at the top of the app rather than inside any single screen — so **Life Paths** and **Ask My Twin**, which both require a built profile, show a live "Building your twin…" state and unlock the instant it's ready, instead of a stale "nothing here yet."
- Optionally clone your voice (ElevenLabs) so any generated text can be spoken back in your own voice, and optionally complete a HeyGen live-webcam consent step to unlock a synthetic **digital-twin video avatar** — a fully rendered version of you that can visually "say" anything you generate. Both of these unlock the two video tiers described above.

### 🧭 Life Paths
- Asks Claude to suggest professions, cities, and activities that plausibly fit your AI Twin's actual observed traits, each with a one-line rationale — framed explicitly as possibilities worth exploring, not a verdict.

### 💬 Ask My Twin
- Describe a real or hypothetical scenario, and Claude predicts how you'd likely react, grounded in your twin profile and past session analyses, along with its own stated confidence level and the reasoning behind the prediction.

### 👤 Accounts
- Sign up with an email and password, or click **Continue As Guest** to use every feature immediately with no signup at all. Guest accounts are ordinary accounts under the hood — same data model, same permissions — just flagged temporary: automatically deleted (database rows and uploaded files both) 24 hours after creation. A one-click **Create Account To Save** converts a guest into a permanent account in place, keeping everything already recorded under it — no data migration needed, since it's the same underlying account.
- Every account's data is isolated at the database query level: every session, twin profile, and uploaded file is scoped to the authenticated user's ID on every read and write. This was verified directly, not just assumed from code review — a second test account was confirmed unable to read or fetch another account's session data or video files.

### 📝 A note on the persona list
The original spec for this app included personas framed around nationality and religion. Those were deliberately left out and replaced with personality- and communication-style axes instead — real, individually-variable dimensions from communication research, rather than personas built on stereotypes tied to someone's ethnicity, nationality, or religion. The same care was applied to newer additions like Affluent/Impoverished: framed around resource-consciousness and outlook, not caricatured speech patterns.

### 📝 A note on "emotion from face" analysis
Reading emotion or confidence from a face or voice is a genuinely contested science — facial expression doesn't map cleanly to internal state. The analysis prompts hedge accordingly ("comes across as," not "is feeling"), and the UI should be read the same way: one interpretive perspective, not a diagnosis.

## 🛠️ Tech stack

**Frontend:** React 19, Vite 8, Tailwind CSS v4, `lucide-react` icons. Browser `MediaRecorder`/`getUserMedia` for capture.

**Backend:** Express 5, `better-sqlite3` (WAL mode), Node's built-in `crypto` for auth (scrypt password hashing + HMAC-signed session cookies — no bcrypt/jsonwebtoken dependency, to avoid native-build friction on deploy).

**External APIs:**
- 🤖 **Anthropic Claude** (`@anthropic-ai/sdk`) — all text/vision analysis: self-presentation analysis, twin-profile building, style rewrites, life-path suggestions, scenario predictions.
- 🎙️ **ElevenLabs** — speech-to-text transcription, voice cloning, text-to-speech playback.
- 🎬 **HeyGen** (optional) — synthetic digital-twin video avatars. Requires a one-time live webcam consent flow on HeyGen's own hosted page (a liveness check this app can't replicate or bypass), opened from the app in a popup rather than a full tab-switch.
- 🎞️ **ffmpeg** (`ffmpeg-static`) — muxes a new audio track onto the original video for the fast "dub" fallback while a synthetic render is in progress or unavailable.

## 🏗️ Architecture

```
server/
  index.js              Express app: CORS, auth-gated routing, ownership-checked
                         /uploads file serving, guest-account cleanup job
  middleware/auth.js     Cookie parsing + requireAuth middleware
  routes/
    auth.js              signup / login / logout / guest / upgrade / me
    sessions.js          recording CRUD, transcription
    analysis.js          Claude analysis + style-variant generation
    twin.js              twin profile, voice cloning, video avatar,
                         variant video/dub generation, life paths, scenarios
    data.js              full per-user data wipe
  services/
    db.js                schema + migrations, all SQL access,
                         including the guest-account cleanup query
    authService.js        password hashing, session token sign/verify
    claudeService.js       all Claude prompts (analysis, twin, variants,
                            life paths, scenario prediction) + style guide list
    elevenLabsService.js   transcription, voice cloning, TTS
    heygenService.js       digital-twin avatar creation, consent, video render
    dubbingService.js      ffmpeg audio-video muxing

src/
  App.jsx                 tab navigation, auth gate, twin-profile state,
                           centralized auto-build-twin trigger
  api.js                  fetch wrappers for every backend endpoint
  voiceConsent.js          localStorage consent-flag helpers, HeyGen consent
                           popup helper
  components/              one component per screen/concern (Recorder,
                            SessionDetail, TwinPanel, LifePathsPanel,
                            ScenarioPanel, Auth, VoiceCloneRecorder, etc.)
```

> **Data model:** every account (real or guest) is a row in `users`; `sessions`, `twin_profile`, `scenario_predictions`, and `life_paths` are scoped by `user_id`; `analyses` and `variants` are scoped indirectly through their parent `session_id`. Every query in every route filters by the authenticated request's `user_id` — verified directly (not just by code review) that one account cannot read or list another's data, sessions, or uploaded files.

> **Auth:** signed HTTP-only cookie (`crypto.createHmac`, not JWT — simpler for a single-purpose session token, no extra dependency). No auth library; ~100 lines of well-tested code across `authService.js` and `middleware/auth.js`.

## ⚙️ Setup

Requires Node 20.19+.

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...      # required
ELEVENLABS_API_KEY=...            # required (transcription; also voice cloning/TTS)
HEYGEN_API_KEY=...                # optional (synthetic video avatars)
SESSION_SECRET=...                # required in production — openssl rand -hex 32
PORT=3101
```

Run in development (two terminals):

```bash
npm run server   # backend on :3101
npm run dev      # frontend on :5173, proxies /api to :3101
```

Or build and run as one process (what production uses):

```bash
npm run build:start
```

## 🚢 Deployment

Deployed on **Railway**: a single Node service (`npm run build && npm run start`) with a persistent volume mounted for `self-mirror.db*` and `server/uploads/`, since both need to survive restarts/redeploys. Environment variables are the same ones from `.env.example`, set as service secrets rather than committed. The GitHub repo is connected for auto-deploy on every push to `main`.

## 🔒 Privacy & data

- This app supports real accounts — every user's recordings, analyses, twin profile, and cloned voice are scoped to their own account and inaccessible to others (see Architecture above).
- Guest accounts are anonymous and temporary: fully functional, but deleted (rows and files) after 24 hours, since there's no credential to reclaim them otherwise.
- Video frames and transcripts are sent to Anthropic for analysis. Recorded clips are sent to ElevenLabs for transcription; a voice sample is sent to ElevenLabs only if you use voice cloning, and to HeyGen only if you use the video-avatar feature.
- Delete a single recording from its detail view, or wipe everything you own (recordings, analyses, twin profile, cloned voice) with "Delete All My Data" in the header — this only ever affects your own account's data.
