// Generates one new weekly prayer focus with Google Gemini and writes
// focus.json + history.json. Runs on a schedule (see .github/workflows).
// Requires: GEMINI_API_KEY env var (Google AI Studio key, free tier works).
// Usage: node generate-focus.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }

const MODEL = 'gemini-3.8-flash';
const HISTORY_FILE = new URL('./history.json', import.meta.url);
const FOCUS_FILE = new URL('./focus.json', import.meta.url);

// ISO calendar week key, e.g. "2026-W44", Monday-based.
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function mondayOf(date = new Date()) {
  const day = date.getDay();
  const m = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (day === 0 ? 6 : day - 1));
  return m.toISOString().slice(0, 10);
}

const history = existsSync(HISTORY_FILE) ? JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) : [];
const usedTitles = new Set(history.map(h => (h.en || '').toLowerCase()));

// Hard blocklist: ministry-internal or local framings must never appear.
const BLOCKED = ['generación relevo', 'generacion relevo', 'brooklyn', 'despertar global',
  'despertar rewind', 'despertar circles', 'despertar compassion', 'despertar workforce',
  'national soccer cup', 'conferencia despertar', 'zúme', 'zume', 'simply mobilizing'];

function clean(f) {
  return f && typeof f.en === 'string' && typeof f.es === 'string' && typeof f.ref === 'string'
    && f.en.trim().length >= 4 && f.es.trim().length >= 4 && f.ref.trim().length >= 3
    && !usedTitles.has(f.en.trim().toLowerCase())
    && !BLOCKED.some(b => (f.en + ' ' + f.es).toLowerCase().includes(b));
}

async function generate(avoidNote) {
  const prompt = `You write one weekly prayer focus for a GLOBAL Christian prayer wall.
Audience: believers worldwide praying for the unreached and the global church.
Rules:
- Global scope ONLY. Never mention a specific ministry, program, church, city, or local community.
- One theme (3-8 words), in English AND Spanish, plus one Bible reference (book chapter:verse).
- Warm, prayerful, distinct from everything listed under "Already used".
- Reply with JSON ONLY, exactly: {"en": "...", "es": "...", "ref": "..."}
Already used (do not repeat or closely paraphrase any of these):
${history.slice(-52).map(h => '- ' + h.en).join('\n') || '(none)'}
${avoidNote || ''}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
      }) });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return JSON.parse(text);
}

let focus = null;
for (let attempt = 1; attempt <= 3 && !focus; attempt++) {
  try {
    const candidate = await generate(attempt > 1 ? `The previous suggestion was rejected (duplicate or blocked wording). Try a clearly different theme.` : '');
    if (clean(candidate)) focus = candidate;
    else console.warn(`Attempt ${attempt}: rejected`, candidate);
  } catch (err) { console.warn(`Attempt ${attempt} failed:`, err.message); }
}
if (!focus) { console.error('Could not generate a valid, non-duplicate focus after 3 attempts.'); process.exit(1); }

const out = {
  week: weekKey(),
  monday: mondayOf(),
  en: focus.en.trim(),
  es: focus.es.trim(),
  ref: focus.ref.trim(),
  generatedAt: new Date().toISOString(),
};
writeFileSync(FOCUS_FILE, JSON.stringify(out, null, 2) + '\n');
history.push(out);
writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
console.log('New focus for', out.week + ':', out.en, `(${out.ref})`);
