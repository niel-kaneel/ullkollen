## Ullkollen Expert Knowledge Layer (RAG)

Building a tactile-knowledge RAG system on top of the existing image classification flow. The user explicitly asked to build admin first, then user-facing — I'll honor that ordering and ship in two phases.

### Phase 1 — Admin: Expert Recordings (`/admin/expertkunskap`)

**Database (migration):**
- Enable `vector` extension.
- `expert_recordings` — id, audio_path, audio_url, klassare_namn, inspelning_datum, wool_class, breed, transcript_full, created_at, updated_at, user_id (uploader).
- `expert_observations` — id, recording_id (fk, cascade), chunk_text, embedding `vector(1536)`, fiber_characteristics text[], wool_class, breed, created_at. HNSW cosine index.
- `user_tactile_descriptions` — id, user_id, classification_id (fk), user_description, image_predicted_class, comparison_result jsonb, retrieved_recording_ids uuid[], led_to_correction bool default false, created_at.
- Storage bucket `expert-audio` (private). RLS: admins full CRUD on recordings/observations; users insert/read own tactile_descriptions; admins read all.

**Server functions (`src/lib/expert.functions.ts`):**
- `transcribeAudio({ path })` → admin only; downloads from Storage, calls OpenAI Whisper with `language: "sv"`, returns transcript.
- `saveRecording({ recordingId?, ...metadata, transcript_full })` → upsert recording + re-chunk + re-embed observations (delete old chunks for that recording first). Chunking: split on sentences, group to ~300–500 chars. Embeddings via OpenAI `text-embedding-3-small` (1536-dim).
- `deleteRecording({ id })` → admin only; deletes row + storage file (cascade handles observations).
- All gated with `requireSupabaseAuth` + admin role check via `has_role(userId, 'admin')`.

**Secret:** `OPENAI_API_KEY` (request via `add_secret` before building).

**UI (`src/routes/app.admin.expertkunskap.tsx`):**
- Admin gate (reuse existing pattern from `app.admin.tsx`).
- Upload form: file input → upload to Storage → call `transcribeAudio` → show editable transcript textarea.
- Metadata: wool_class select (P1/P1B/P2/P2P/P3/C1/C2/C3 + Swedish breeds list reusing `src/lib/breeds.ts`), breed select, fiber characteristics multi-select chips (mjukhet, krusning, fetthalt, stickighet, glans, lockstruktur, styrka, märghår, bottenull), klassare name, datum.
- List existing recordings with edit/delete/re-transcribe.
- Add nav link in admin route.

### Phase 2 — User: "Känn på ullen" on result screen

**Server function `compareTactile({ classificationId, description })`:**
- Embed user description.
- pgvector RPC `match_expert_observations(query_embedding, wool_class_filter, match_count)` returning observations + parent recording metadata + similarity.
- If zero matches: store user description in `user_tactile_descriptions`, return empty-state payload.
- Else call Lovable AI (`google/gemini-3-flash-preview`) with tool-calling for structured output: `{ opening_line, matches[], differs[], not_mentioned[], possible_reclassification: { suggested_class?, reason? } | null }`. System prompt instructs: only use facts from retrieved observations; explicitly list user-mentioned things not covered.
- Persist `user_tactile_descriptions` row with result + retrieved recording ids; set `led_to_correction` later if user confirms.
- Return result + source recordings (name, datum, signed audio URL, duration if available).

**UI additions to `src/routes/app.result.$id.tsx`:**
- New "KÄNN PÅ ULLEN" section below Rekommendation card, same visual rhythm.
- Text input + voice record button (MediaRecorder → upload temp → Whisper transcribe → fill input). Empty-state hint, expandable "Vad ska jag känna efter?" helper with short Swedish blurbs.
- Submit "Jämför med klassare" → loading → result card "SÅ SKULLE EN KLASSARE KÄNNA" with the three subsections (green ✓ / amber ⚠ / grey ℹ), opening line interpolated with class.
- Source transparency block: per recording → name, date, inline `<audio>` from signed Storage URL.
- "MÖJLIG OMKLASSNING" card when AI returns a `possible_reclassification` → "Föreslå ny klass" button hooks into existing correction flow (sets `wool_class`, `user_confirmed`, `original_wool_class`).
- Empty/error states per spec.
- i18n: Swedish copy as literals (matches existing pattern in this route — most strings are wrapped with `t()` but Swedish-first; will add `t()` entries for new keys in `sv` + `en` dicts in `src/lib/i18n.tsx`).

### Stack notes

- Transcription + comparison both go through TanStack server functions (not edge functions), per the project's `server-side-modern` rules.
- Comparison model: user spec says Claude/GPT-4 swappable. I'll route through **Lovable AI Gateway** (`openai/gpt-5` default, swappable via constant) — no extra API key needed, fits the project's "use Lovable AI by default" rule. I'll flag this in the response so you can override if you specifically want Anthropic direct.
- OpenAI key still needed for Whisper + embeddings (Lovable AI Gateway embeddings exist but the spec explicitly asks for `text-embedding-3-small` via OpenAI).

### What I need from you before starting

1. Confirm I should use **Lovable AI Gateway** for the comparison LLM (no extra key) instead of wiring Anthropic directly. If you want Anthropic, I'll request `ANTHROPIC_API_KEY` instead/additionally.
2. I'll request `OPENAI_API_KEY` via the secret tool for Whisper + embeddings.

Approve and I'll start with the migration + admin page, then phase 2.
