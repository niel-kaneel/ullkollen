# Ullkollen — Setup

Mobile-first PWA for Swedish sheep farmers. AI wool classification + shearer directory.

## 1. Run the database schema

Open your Supabase project SQL editor and paste/run the entire contents of
`database_schema.sql` (the file you uploaded). It creates:
- `profiles`, `sheep`, `classifications`, `shearers`, `bookings` tables
- PostGIS extension + `nearest_shearers()` RPC
- `sheep-photos` storage bucket + RLS policies
- 5 placeholder shearers

## 2. Deploy the Edge Function

```bash
# Install Supabase CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref hebsejawtxdmumccvojn

# Add your Anthropic key as a secret (it never reaches the client)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy the function
supabase functions deploy classify-wool
```

The function lives at `supabase/functions/classify-wool/index.ts` in this repo.

## 3. Connection details (already wired)

The Supabase URL and publishable key are baked into `src/lib/supabase.ts`.
The Edge Function is invoked via `supabase.functions.invoke("classify-wool", ...)`.

## 4. PWA install

`public/manifest.webmanifest` ships with the app. After publishing, farmers can
"Add to Home Screen" from Safari/Chrome and use Ullkollen like a native app.
(No service worker is registered to keep the editor preview reliable; we can
add one later for true offline support.)

## Tech

- TanStack Start (file-based routing in `src/routes/`)
- Tailwind v4 + shadcn/ui
- Supabase (auth, DB, storage, Edge Functions)
- Claude Opus Vision via Anthropic API
- Swedish/English via `useTranslation()` from `src/lib/i18n.tsx`
