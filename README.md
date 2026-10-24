# Prayer Focus Server (Gemini-powered, serverless)

Every Monday, Google Gemini writes one brand-new GLOBAL prayer focus
(English + Spanish + scripture reference) and publishes it as `focus.json`.
The prayer wall widget fetches that file; if the fetch ever fails, the
widget falls back to its built-in 52-week rotation, so the wall never
goes blank.

## How it works

1. GitHub Actions runs `generate-focus.mjs` every Monday 12:00 UTC.
2. The script prompts Gemini with hard rules: global scope only (no
   ministry programs, churches, or local places), EN + ES + reference,
   and a blocklist plus the full history file so nothing repeats.
3. It validates the result (both languages present, not a duplicate,
   nothing blocked), writes `focus.json`, appends to `history.json`,
   and commits. GitHub Pages serves the new file within minutes.
4. The widget reads `focus.json` on load (see FOCUS_URL in
   prayer-wall-fixed.html) and shows that week's focus.

## Setup (once)

1. Create a free Gemini API key at Google AI Studio (aistudio.google.com
   > Get API key). Free tier covers one generation a week easily.
2. Put these files in a new GitHub repo (public, so Pages can serve
   focus.json).
3. Repo Settings > Secrets and variables > Actions > add secret
   `GEMINI_API_KEY` with the key from step 1.
4. Repo Settings > Pages > Source: GitHub Actions.
5. Run the workflow once manually (Actions tab > Weekly prayer focus >
   Run workflow) to test it.
6. Copy the Pages URL (https://<you>.github.io/<repo>/focus.json) into
   the widget's FOCUS_URL line, then re-embed the widget in Google Sites.

## Costs

Effectively $0: one Gemini Flash generation per week (free tier) +
GitHub Actions/Pages free tier. The API key is only ever in the GitHub
secret and the Action runner — never in the website code.
