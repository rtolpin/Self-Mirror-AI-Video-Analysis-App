# Self-Mirror

A personal self-reflection tool: record yourself for a specific context (a date, a job interview, a presentation), get an honest AI read on how you came across, build an "AI Twin" of your personality and speech patterns, hear or watch yourself say things in different registers, and ask your twin how you'd likely react to a situation.

**Live app:** [PLACEHOLDER — filled in after deploy]

## What it does

### Record & Analyze
- Pick what you're preparing for (search common occasions or type your own) and record a short video of yourself, or skip straight to a general self-analysis.
- The clip is transcribed server-side automatically (via ElevenLabs Scribe — works consistently across every browser, unlike the browser's built-in speech APIs).
- Claude looks at a few frames plus the transcript and gives an honest, specific, constructive read: overall sentiment, a confidence score, body-language notes, strengths, growth areas, and how well it fits the stated context.

### AI Twin
- Builds a personality/speech-pattern profile from everything you've recorded — core traits, speech patterns, common phrases, thought-process style, values, communication tendencies.
- Builds itself automatically the moment you have a recorded session and no twin yet (no button-hunting required), and updates incrementally as you record more.
- Optionally clone your own voice (ElevenLabs) so any generated text can be played back in your own voice, and optionally set up a synthetic video avatar (HeyGen digital twin) for a fully rendered talking version of you.

### Try Different Versions Of You
- Rewrites what you actually said in 50+ styles — personality axes (More/Less Confident, More Aggressive/Happiness/Sadness, Self-Aware, Humble, Vulnerable...), professional personas (Consultant, Big Boss, Manager, Intern, Businessman/Business Woman...), and communication-style axes grounded in real linguistics research rather than stereotypes (Direct & To-the-Point vs. Warm & Expressive, Values-Led vs. Pragmatic) — see "A note on the persona list" below.
- If you've cloned your voice, generation automatically narrates the result in your own voice (dubbed over your original footage) or, if you've set up a video avatar, kicks off a fully synthetic re-recording of you saying it — HeyGen's rendering can take several minutes, so the fast dub shows immediately as a placeholder while the synthetic version renders in the background and swaps in automatically.

### Life Paths
- Suggests professions, cities, and activities grounded in your AI Twin's actual observed traits — a set of possibilities to consider, not a single "right answer."

### Ask My Twin
- Describe a real or hypothetical situation and get a grounded prediction of how you'd likely react, based on patterns observed across your sessions, plus a confidence level and reasoning.

### Accounts
- Real email/password accounts, or **try the whole app as a guest with no signup** — guest data is fully functional but temporary (auto-deleted after 24 hours), with a one-click upgrade path to a real account that preserves everything already created under it.

### A note on the persona list
The original spec for this app included personas framed around nationality and religion. Those were deliberately left out and replaced with personality- and communication-style axes instead — real, individually-variable dimensions from communication research, rather than personas built on stereotypes tied to someone's ethnicity, nationality, or religion. The same care was applied to newer additions like Affluent/Impoverished: framed around resource-consciousness and outlook, not caricatured speech patterns.

### A note on "emotion from face" analysis
Reading emotion or confidence from a face or voice is a genuinely contested science — facial expression doesn't map cleanly to internal state. The analysis prompts hedge accordingly ("comes across as," not "is feeling"), and the UI should be read the same way: one interpretive perspective, not a diagnosis.

## Tech stack

**Frontend:** React 19, Vite 8, Tailwind CSS v4, `lucide-react` icons. Browser `MediaRecorder`/`getUserMedia` for capture.

**Backend:** Express 5, `better-sqlite3` (WAL mode), Node's built-in `crypto` for auth (scrypt password hashing + HMAC-signed session cookies — no bcrypt/jsonwebtoken dependency, to avoid native-build friction on deploy).

**External APIs:**
- **Anthropic Claude** (`@anthropic-ai/sdk`) — all text/vision analysis: self-presentation analysis, twin-profile building, style rewrites, life-path suggestions, scenario predictions.
- **ElevenLabs** — speech-to-text transcription, voice cloning, text-to-speech playback.
- **HeyGen** (optional) — synthetic digital-twin video avatars. Requires a one-time live webcam consent flow on HeyGen's own hosted page (a liveness check this app can't replicate or bypass), opened from the app in a popup rather than a full tab-switch.
- **ffmpeg** (`ffmpeg-static`) — muxes a new audio track onto the original video for the fast "dub" fallback while a synthetic render is in progress or unavailable.

## Architecture

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
    db.js                schema + migrations, all SQL access
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

**Data model:** every account (real or guest) is a row in `users`; `sessions`, `twin_profile`, `scenario_predictions`, and `life_paths` are scoped by `user_id`; `analyses` and `variants` are scoped indirectly through their parent `session_id`. Every query in every route filters by the authenticated request's `user_id` — verified directly (not just by code review) that one account cannot read or list another's data, sessions, or uploaded files.

**Auth:** signed HTTP-only cookie (`crypto.createHmac`, not JWT — simpler for a single-purpose session token, no extra dependency). No auth library; ~100 lines of well-tested code across `authService.js` and `middleware/auth.js`.

## Setup

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

## Deployment

Deployed on Railway: a single Node service (`npm run build && npm run start`) with a persistent volume mounted for `self-mirror.db*` and `server/uploads/`, since both need to survive restarts/redeploys. Environment variables are the same ones from `.env.example`, set as service secrets rather than committed.

## Privacy & data

- This app now supports real accounts — every user's recordings, analyses, twin profile, and cloned voice are scoped to their own account and inaccessible to others (see Architecture above).
- Guest accounts are anonymous and temporary: fully functional, but deleted (rows and files) after 24 hours, since there's no credential to reclaim them otherwise.
- Video frames and transcripts are sent to Anthropic for analysis. Recorded clips are sent to ElevenLabs for transcription; a voice sample is sent to ElevenLabs only if you use voice cloning, and to HeyGen only if you use the video-avatar feature.
- Delete a single recording from its detail view, or wipe everything you own (recordings, analyses, twin profile, cloned voice) with "Delete All My Data" in the header — this only ever affects your own account's data.
