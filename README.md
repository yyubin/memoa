# Memoa

A spaced-repetition web app for English vocabulary and sentences, built for Korean learners. Pick a class (Paladin, Gunner, Spellblade, Witch) and level up your character as you review.

- **Svelte 5 + Vite**: static SPA, no server runtime
- **Supabase**: auth, Postgres with RLS, an Edge Function for AI
- **ts-fsrs** (FSRS-7) scheduling, with in-browser per-user parameter optimization (fsrs-rs via WASM)
- **Claude API**: fills in Korean/English meanings, synonyms, antonyms and examples from a word, and extracts words from photos

## Question types

| Type | Format |
|---|---|
| Meaning (Korean) / Meaning (English) | Flip card |
| Recall | Type the word from its meaning |
| Synonym | "closest in meaning to" multiple choice, with the word highlighted in an example |
| Antonym | Multiple choice; synonyms appear as trap options |
| Cloze | Type the inflected form into an example sentence |
| Listening | Browser TTS, type the spelling |
| Sentence → Korean / Korean → sentence | Flip card |

## Review behavior (Anki-style)

- FSRS-7 with 90% target retention, learning steps 1m → 10m, relearning step 10m
- Day rollover at 4 AM; learn-ahead limit 20 minutes
- Sibling burying: other cards of the same word don't appear on the same day
- New cards are mixed evenly between reviews by default (per deck: mix / after reviews / before reviews)
- Leeches: a card is flagged after 8 lapses, then every 4 more (per deck threshold; tag only or tag + suspend)
- Other question types unlock only after the word's "Meaning (Korean)" card graduates
- Auto-grading only *suggests* a rating; you confirm it (Enter accepts the suggestion)
- Per-user FSRS optimization (Profile → FSRS) runs fsrs-rs in the browser after 400+ reviews and is applied only if it lowers log loss

Shortcuts: `Space` show answer · `1–4` pick option / rate · `Enter` accept suggested rating · `Ctrl+Z` undo

## Development

```bash
npm install
cp .env.example .env.local   # Supabase URL / anon key
npm run dev
npm test        # unit tests (queue, grading, FSRS, optimizer, levels)
npm run check   # type check
```

The optimizer needs the page to be cross-origin isolated. The dev server sends `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` (see `vite.config.ts`), and `public/_headers` does the same on Cloudflare Pages. Any third-party resource you add must be CORS/CORP-enabled.

## Supabase setup (once)

```bash
supabase login
supabase link --project-ref cslrrflgovmyvfartanc
supabase db push                                   # schema + RLS
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # the key lives only here
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://<your-domain>
supabase functions deploy enrich
```

Optional secrets:
- `CLAUDE_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is much cheaper)
- `AI_DAILY_LIMIT` (default 40) / `AI_ADMIN_DAILY_LIMIT` (default 300): AI-generated words per user per day
- `ANTHROPIC_WORKSPACE_ID`: required only if your API key isn't scoped to a workspace (sent as the `anthropic-workspace-id` header). A workspace-scoped key doesn't need it.

Dashboard:
- Authentication → Sign In / Providers → Email: turn off email confirmation so sign-up logs in immediately (the built-in mailer is rate-limited)
- Authentication → URL Configuration: set Site URL to your deployed domain

## Sign-up and invites

- **The first account becomes the admin** (no invite code needed)
- Everyone after that needs an invite code from Profile → Invite friends (valid 14 days, single use)

## Security notes

- RLS on every table: users can only access their own rows; `is_admin` can't be changed from the client
- The AI key exists only in Edge Function secrets; the function verifies the JWT and enforces a per-user daily limit
- AI results for typed words go into a shared `word_cache` (no repeat calls for the same word); photo results are not cached
- Card content is always rendered as text (no `{@html}`), plus a CSP
