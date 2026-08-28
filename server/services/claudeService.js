import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-5';

function getClient() {
  const options = { apiKey: process.env.ANTHROPIC_API_KEY };
  // Personal/identity-linked API keys act across multiple workspaces and
  // require the caller to say which workspace a request should run in.
  if (process.env.ANTHROPIC_WORKSPACE_ID) {
    options.defaultHeaders = { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID };
  }
  return new Anthropic(options);
}

function extractText(response) {
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('No text block in response');
  return block.text.trim();
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

const BASE_SYSTEM = `You are the analysis engine behind "Self-Mirror," a self-reflection app. A person records themselves and asks for an honest read on how they came across.

Ground rules:
- Reading emotion or confidence from a face, voice, or transcript is an interpretive best guess, not a diagnostic fact. Never claim certainty you don't have. Hedge naturally ("comes across as", "reads as") rather than asserting internal states as fact.
- Be genuinely honest, including about things that aren't working — but honest means direct and specific, not harsh or humiliating. Pair every critique with something concrete the person can do about it.
- Never speculate about the person's race, ethnicity, nationality, religion, or other protected characteristics, and never frame feedback in terms of those categories.
- Ground feedback in what's actually observable in the transcript/images provided — specific word choices, pacing, filler words, what was and wasn't said — not generic personality-test language.
- Return ONLY valid JSON, no prose outside the JSON.`;

export async function analyzeSelfPresentation({ context, images, transcript }) {
  const contextLabel = (context || '').trim() || 'general self-analysis (no specific occasion)';

  const content = [
    {
      type: 'text',
      text: `Context: the person recorded themselves preparing for / practicing ${contextLabel}.

Transcript of what they said (may be partial or empty if speech-to-text wasn't available):
"""
${transcript || '(no transcript captured)'}
"""

${images?.length ? `Attached are ${images.length} still frame(s) captured during the recording.` : 'No image frames were provided — base the analysis on the transcript alone and say so.'}

Give an honest, specific analysis of how they came across for this context. Return ONLY this JSON shape:

{
  "overallSentiment": "one sentence, plain language summary of the overall vibe",
  "confidenceScore": <integer 0-10>,
  "emotionalTone": "2-3 words, e.g. 'warm but guarded'",
  "bodyLanguageNotes": "1-2 sentences on posture/expression IF images were provided, otherwise null",
  "honestFeedback": "3-5 sentences of direct, specific, constructive feedback tailored to ${contextLabel}",
  "strengths": ["specific strength 1", "specific strength 2"],
  "growthAreas": ["specific, actionable thing to work on 1", "specific, actionable thing to work on 2"],
  "keyPhrases": ["notable phrase or word choice actually used, if any"],
  "contextFitNotes": "1-2 sentences on how well this presentation fits ${contextLabel} specifically"
}`,
    },
  ];

  for (const img of images || []) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    });
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1400,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content }],
  });

  return extractJson(extractText(response));
}

export async function buildTwinProfile({ transcripts, existingPersonality }) {
  const transcriptBlock = transcripts
    .map((t, i) => `Session ${i + 1} (${t.context}):\n"""\n${t.transcript || '(no transcript)'}\n"""`)
    .join('\n\n');

  const prompt = `Build (or update) a personality/speech profile for this person's "AI Twin" — an internal model of how they talk and think, used later to generate style variants and predict their reactions. This is NOT for impersonating them to other people; it's a private self-reflection tool.

${existingPersonality ? `Existing profile to refine, not discard:\n${JSON.stringify(existingPersonality, null, 2)}\n\n` : ''}Transcripts collected so far:
${transcriptBlock}

Return ONLY this JSON shape:
{
  "summary": "2-3 sentences describing who this person comes across as",
  "corePersonalityTraits": ["trait 1", "trait 2", "trait 3"],
  "speechPatterns": "description of pacing, filler words, sentence length, vocabulary tendencies actually observed",
  "commonPhrases": ["phrase or verbal tic actually used, if any"],
  "thoughtProcessStyle": "how they seem to reason through things out loud - e.g. linear vs associative, cautious vs decisive",
  "valuesAndPriorities": "what they seem to care about based on what they chose to talk about",
  "communicationTendencies": "how directly/indirectly, formally/casually they tend to communicate"
}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  return extractJson(extractText(response));
}

const STYLE_GUIDES = {
  more_confident: 'more self-assured: firmer claims, less hedging, steadier pacing',
  less_confident: 'more tentative: more hedging and softening language, less certainty',
  more_aggressive: 'more assertive and forceful: pushes points harder, less softening, more direct pressure',
  less_aggressive: 'more gentle and non-confrontational: softer delivery, more accommodation, less pushback',
  more_happiness: 'brighter and more upbeat in tone, without changing the substance',
  more_sadness: 'more subdued and reflective, tinged with melancholy',
  more_introspective: 'more inward-looking, pausing to examine their own motives and feelings',
  cool_girl: 'effortlessly unbothered, dry humor, low-key confidence',
  instagram_ready: 'polished, upbeat, curated - the highlight-reel version of this moment',
  smart_girl: 'sharper, more analytical, leads with insight and precise language',
  smart_boy: 'sharper, more analytical, leads with insight and precise language',
  values_led: 'speaks more from a place of personal meaning, purpose, and conviction',
  pragmatic: 'speaks more from practicality and results, less from abstract conviction',
  direct_low_context: 'blunt and to the point, says what they mean with minimal cushioning',
  warm_high_context: 'relationship-first, expressive, reads the room and softens directness',
  formal_reserved: 'composed, measured, understated - keeps things professional',
  casual_playful: 'informal, humor-forward, relaxed phrasing',
  masculine: 'more direct and assertive - leads with conclusions and confidence, minimal hedging or relational framing',
  feminine: 'more relational and expressive - reads the room, builds rapport and connection before landing on conclusions',
  corporate: 'buttoned-up business register - structured, results-oriented, professional phrasing over personal color',
  consultant: 'frameworks-and-recommendations voice - lays out the situation, the options, and a clear recommendation, confident but caveated',
  big_boss: 'commanding and decisive - short declarative statements, speaks like the final word in the room, no need to justify',
  manager: 'coordinating and supportive - organizes people and next steps, checks in, balances directness with encouragement',
  intern: 'eager and deferential - enthusiastic, asks clarifying questions, hedges more, wants to prove themselves',
  spiritual: 'reflective and meaning-seeking - speaks in terms of intention, energy, growth, and inner alignment rather than logistics',
  affluent: 'unhurried and abundance-minded - speaks as though resources and options are plentiful, casually references quality and ease',
  impoverished: 'scarcity-aware and resourceful - weighs cost and tradeoffs explicitly, values practicality over polish, no assumption that options are unlimited',
  upscale: 'refined and elevated - polished vocabulary, understated confidence, references quality and taste',
  fancy: 'ornate and stylized - more elaborate word choice and flourish, playfully theatrical',
  empathetic: 'leads with feelings and understanding - names emotions, validates, checks in on how others feel before problem-solving',
  organized: 'structured and sequential - orders points clearly, plan-oriented language, minimal tangents',
  disciplined: 'controlled and consistent - measured pacing, sticks to the point, avoids impulsive tangents or filler',
  humble: 'modest and self-effacing - downplays their own role, credits others, avoids overselling accomplishments',
  self_aware: 'reflective about their own patterns - names their own tendencies and blind spots openly while speaking',
  dismissive: 'detached and minimizing - brushes past details, downplays importance, short and unbothered responses',
  open_and_honest: 'transparent and unguarded - says what they actually think and feel plainly, minimal filtering or diplomatic softening',
  vulnerable: 'emotionally exposed - admits uncertainty, fear, or need openly rather than protecting a confident front',
  sensitive: 'attuned and easily affected - notices emotional undertones, reacts more visibly to what\'s said, speaks carefully',
  playful: 'teasing and light-hearted - jokes, banter, keeps a mischievous energy even on serious topics',
  energetic: 'high-energy and animated - faster pacing, more enthusiasm markers, dialed-up excitement throughout',
  movie_star: 'magnetic and camera-ready - speaks like they\'re aware of an audience, charismatic, a little larger-than-life',
  actress: 'performative and expressive - leans into emotion and delivery like performing a scene, dramatic pacing and inflection choices',
  actor: 'performative and expressive - leans into emotion and delivery like performing a scene, dramatic pacing and inflection choices',
  international: 'cosmopolitan and audience-aware - speaks as if addressing a broad, global audience, avoids region-specific slang or references',
  businessman: 'polished and results-first - assertive, efficient, minimal small talk, speaks like closing a deal',
  business_woman: 'polished and competence-first - assured, well-prepared, detail-aware, gets to the point efficiently',
  city_girl: 'fast-paced and plugged-in - references pace and options, efficient with time, always aware of what\'s current',
  rural_girl: 'grounded and unhurried - values straightforwardness, community, and practicality over polish or urgency',
  influencer: 'highly audience-aware - upbeat, personable, frames things for shareability, invites the listener in',
  sarcastic: 'dry and wry - deadpan irony, understatement, says the opposite of what they mean for effect',
  humor: 'finds the funny angle - lighthearted asides, playful exaggeration, doesn\'t take it too seriously',
};

export async function generateVariant({ transcript, twinProfile, style }) {
  const guide = STYLE_GUIDES[style] || style;
  const prompt = `Here is what this person actually said:
"""
${transcript || '(no transcript captured)'}
"""

Their speech/personality profile:
${JSON.stringify(twinProfile, null, 2)}

Rewrite what they said as a "${style}" variant: ${guide}.

Keep it recognizably them - same underlying speech patterns and vocabulary tendencies from their profile - just dialed toward this style. Don't invent facts or claims they didn't make.

Return ONLY this JSON shape:
{
  "style": "${style}",
  "rewrittenText": "the rewritten version of what they said",
  "whatChanged": "1-2 sentences on what specifically shifted"
}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 800,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  return extractJson(extractText(response));
}

export async function predictScenario({ scenario, twinProfile, analysesSummary }) {
  const prompt = `This person wants a prediction of how they'd likely react to a situation, based on patterns observed across their recorded sessions.

Their profile:
${JSON.stringify(twinProfile, null, 2)}

Summary of past session analyses:
${analysesSummary || '(none yet)'}

Situation to predict a reaction to (this may be a current situation they're in, or a hypothetical future one):
"""
${scenario}
"""

Return ONLY this JSON shape:
{
  "predictedReaction": "3-5 sentences: a grounded, specific prediction of how they'd likely think, feel, and act",
  "reasoning": "1-2 sentences on which observed patterns this prediction is based on",
  "confidenceInPrediction": "low" | "medium" | "high"
}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 900,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  return extractJson(extractText(response));
}

export async function generateLifePaths({ twinProfile, analysesSummary }) {
  const prompt = `Based on this person's observed personality and communication profile, suggest potential life directions. This is meant to open possibilities, not prescribe a single "right" answer.

Profile:
${JSON.stringify(twinProfile, null, 2)}

Summary of past session analyses:
${analysesSummary || '(none yet)'}

Return ONLY this JSON shape:
{
  "overallNarrative": "2-3 sentences on the kind of paths that seem to fit this person and why",
  "suggestedProfessions": [{ "title": "profession", "why": "1-2 sentences tying it to specific observed traits" }],
  "suggestedCities": [{ "city": "city", "why": "1-2 sentences tying it to specific observed traits" }],
  "suggestedActivities": [{ "activity": "activity or hobby", "why": "1-2 sentences tying it to specific observed traits" }]
}

Give 3-4 items in each list. Keep suggestions varied, not all pointing the same direction.`;

  // 4 lists of 3-4 items, each with its own explanation, plus a narrative,
  // routinely ran past a tighter budget here and got cut off mid-JSON —
  // this is the most token-heavy structured response in this file.
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: BASE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  return extractJson(extractText(response));
}

export const STYLE_OPTIONS = Object.keys(STYLE_GUIDES);
