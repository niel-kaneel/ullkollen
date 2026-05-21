import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OPENAI_API = "https://api.openai.com/v1";
const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims
const COMPARISON_MODEL = process.env.COMPARISON_MODEL || "openai/gpt-5-mini";

// ─── Helpers ──────────────────────────────────────────────────────────────

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Endast administratörer.");
}

function chunkTranscript(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > 450) {
      if (cur) chunks.push(cur.trim());
      cur = s;
    } else {
      cur = (cur ? cur + " " : "") + s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.trim()].filter(Boolean);
}

async function openaiEmbed(inputs: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY saknas.");
  const res = await fetch(`${OPENAI_API}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function whisperTranscribe(audio: Uint8Array, filename: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY saknas.");
  const form = new FormData();
  form.append("file", new Blob([audio.buffer as ArrayBuffer]), filename);
  form.append("model", "whisper-1");
  form.append("language", "sv");
  const res = await fetch(`${OPENAI_API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── ADMIN: transcribe audio already in storage ───────────────────────────

export const transcribeRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ audio_path: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: file, error } = await supabaseAdmin.storage
      .from("expert-audio")
      .download(data.audio_path);
    if (error || !file) throw new Error(error?.message || "Kunde inte hämta ljudfil.");
    const buf = new Uint8Array(await file.arrayBuffer());
    const filename = data.audio_path.split("/").pop() || "audio.m4a";
    const transcript = await whisperTranscribe(buf, filename);
    return { transcript };
  });

// ─── ADMIN: save recording + (re)embed observations ───────────────────────

const SaveRecordingInput = z.object({
  id: z.string().uuid().optional(),
  audio_path: z.string().min(1),
  klassare_namn: z.string().nullable().optional(),
  inspelning_datum: z.string().nullable().optional(),
  wool_class: z.string().nullable().optional(),
  breed: z.string().nullable().optional(),
  transcript_full: z.string().min(1),
  fiber_characteristics: z.array(z.string()).default([]),
});

export const saveRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SaveRecordingInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const recordingPayload = {
      audio_path: data.audio_path,
      klassare_namn: data.klassare_namn ?? null,
      inspelning_datum: data.inspelning_datum ?? null,
      wool_class: data.wool_class ?? null,
      breed: data.breed ?? null,
      transcript_full: data.transcript_full,
      user_id: context.userId,
    };

    let recordingId = data.id;
    if (recordingId) {
      const { error } = await supabaseAdmin
        .from("expert_recordings")
        .update(recordingPayload)
        .eq("id", recordingId);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("expert_observations").delete().eq("recording_id", recordingId);
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("expert_recordings")
        .insert(recordingPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      recordingId = row.id;
    }

    const chunks = chunkTranscript(data.transcript_full);
    if (chunks.length) {
      const embeddings = await openaiEmbed(chunks);
      const rows = chunks.map((chunk_text, i) => ({
        recording_id: recordingId,
        chunk_text,
        embedding: embeddings[i] as unknown as string, // pgvector accepts array literal
        fiber_characteristics: data.fiber_characteristics,
        wool_class: data.wool_class ?? null,
        breed: data.breed ?? null,
      }));
      const { error } = await supabaseAdmin.from("expert_observations").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { id: recordingId, chunks: chunks.length };
  });

export const deleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), audio_path: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.storage.from("expert-audio").remove([data.audio_path]);
    const { error } = await supabaseAdmin.from("expert_recordings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── USER-side: transcribe arbitrary uploaded audio blob (Whisper, sv) ────

export const transcribeUserAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ audio_base64: z.string().min(1), filename: z.string().default("voice.webm") }).parse(i),
  )
  .handler(async ({ data }) => {
    const bytes = b64ToBytes(data.audio_base64);
    if (bytes.length > 25 * 1024 * 1024) throw new Error("Filen är för stor (max 25 MB).");
    const transcript = await whisperTranscribe(bytes, data.filename);
    return { transcript };
  });

// ─── USER: tactile comparison ─────────────────────────────────────────────

const CompareInput = z.object({
  classification_id: z.string().uuid(),
  description: z.string().min(3).max(4000),
});

type ComparisonResult = {
  opening_line: string;
  matches: string[];
  differs: string[];
  not_mentioned: string[];
  possible_reclassification: { suggested_class: string | null; reason: string | null } | null;
};

export const compareTactile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CompareInput.parse(i))
  .handler(async ({ data, context }) => {
    // Load the classification (RLS via user-scoped client)
    const { data: cls, error: clsErr } = await context.supabase
      .from("classifications")
      .select("id, wool_class, wool_class_name_sv")
      .eq("id", data.classification_id)
      .maybeSingle();
    if (clsErr) throw new Error(clsErr.message);
    if (!cls) throw new Error("Klassificering saknas.");

    // Embed user description
    const [embedding] = await openaiEmbed([data.description]);

    // Retrieve top observations for this class
    const { data: matches, error: matchErr } = await supabaseAdmin.rpc(
      "match_expert_observations",
      {
        query_embedding: embedding as unknown as string,
        match_count: 5,
        wool_class_filter: cls.wool_class,
      },
    );
    if (matchErr) throw new Error(matchErr.message);

    const observations = (matches ?? []) as Array<{
      id: string;
      recording_id: string;
      chunk_text: string;
      wool_class: string | null;
      similarity: number;
    }>;

    // Empty state: still persist the user description
    if (!observations.length) {
      await supabaseAdmin.from("user_tactile_descriptions").insert({
        user_id: context.userId,
        classification_id: data.classification_id,
        user_description: data.description,
        image_predicted_class: cls.wool_class,
        comparison_result: null,
        retrieved_recording_ids: [],
      });
      return {
        empty: true as const,
        wool_class: cls.wool_class,
        sources: [] as Array<{ id: string; klassare_namn: string | null; inspelning_datum: string | null; audio_url: string | null }>,
        result: null,
      };
    }

    // Load source recordings (deduped)
    const recIds = Array.from(new Set(observations.map((o) => o.recording_id)));
    const { data: recs } = await supabaseAdmin
      .from("expert_recordings")
      .select("id, klassare_namn, inspelning_datum, audio_path")
      .in("id", recIds);

    const sources = await Promise.all(
      (recs ?? []).map(async (r) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("expert-audio")
          .createSignedUrl(r.audio_path, 3600);
        return {
          id: r.id,
          klassare_namn: r.klassare_namn,
          inspelning_datum: r.inspelning_datum,
          audio_url: signed?.signedUrl ?? null,
        };
      }),
    );

    // Build prompt and call comparison LLM via Lovable AI
    const expertContext = observations
      .map((o, i) => `[${i + 1}] (klass ${o.wool_class ?? "?"}) ${o.chunk_text}`)
      .join("\n");

    const systemPrompt = `Du är en assistent som jämför en lekmans känselbeskrivning av ull med citerade observationer från en erfaren svensk ullklassare. Du får INTE hitta på taktila omdömen som inte stöds av de citerade observationerna. Allt som användaren nämner men som klassaren inte berör ska du explicit lista som "inte nämnt av klassaren". Svara alltid på svenska.

Returnera resultatet via verktyget compare_tactile.

Fält:
- opening_line: ett kort stycke som börjar "En erfaren klassare skulle troligen beskriva denna ${cls.wool_class ?? "okända"}-ull som…" och sammanfattar klassarens bild av denna klass (1–2 meningar, baserat ENDAST på citaten).
- matches: punktlista (svenska, korta meningar) över det användaren beskrev som även klassaren bekräftar.
- differs: punkter där användarens beskrivning skiljer sig från klassarens.
- not_mentioned: saker användaren nämnde som inte alls berörs av citaten.
- possible_reclassification: om användarens känselbeskrivning starkt tyder på en ANNAN ullklass än ${cls.wool_class ?? "?"}, returnera { suggested_class, reason } (svenskt motiv). Annars null.`;

    const userPrompt = `Användarens beskrivning:
"""
${data.description}
"""

Klassarens observationer (endast dessa får du citera):
${expertContext}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY saknas.");

    const tool = {
      type: "function",
      function: {
        name: "compare_tactile",
        description: "Strukturerad jämförelse mellan användarens taktila beskrivning och klassarens observationer.",
        parameters: {
          type: "object",
          properties: {
            opening_line: { type: "string" },
            matches: { type: "array", items: { type: "string" } },
            differs: { type: "array", items: { type: "string" } },
            not_mentioned: { type: "array", items: { type: "string" } },
            possible_reclassification: {
              type: ["object", "null"],
              properties: {
                suggested_class: { type: ["string", "null"] },
                reason: { type: ["string", "null"] },
              },
              required: ["suggested_class", "reason"],
              additionalProperties: false,
            },
          },
          required: ["opening_line", "matches", "differs", "not_mentioned", "possible_reclassification"],
          additionalProperties: false,
        },
      },
    } as const;

    const llmRes = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: COMPARISON_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "compare_tactile" } },
      }),
    });

    if (!llmRes.ok) {
      const body = await llmRes.text();
      console.error("Comparison LLM failed", llmRes.status, body);
      if (llmRes.status === 429) throw new Error("För många förfrågningar just nu — försök igen om en stund.");
      if (llmRes.status === 402) throw new Error("AI-krediter behövs — kontakta admin.");
      throw new Error("Jämförelsen misslyckades. Försök igen.");
    }

    const payload = (await llmRes.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const argsRaw = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) throw new Error("Tomt svar från AI.");
    const result = JSON.parse(argsRaw) as ComparisonResult;

    // Persist
    await supabaseAdmin.from("user_tactile_descriptions").insert({
      user_id: context.userId,
      classification_id: data.classification_id,
      user_description: data.description,
      image_predicted_class: cls.wool_class,
      comparison_result: result,
      retrieved_recording_ids: recIds,
    });

    return {
      empty: false as const,
      wool_class: cls.wool_class,
      sources,
      result,
    };
  });

// ─── ADMIN: list recordings (with signed audio URLs) ──────────────────────

export const listExpertRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: recs, error } = await supabaseAdmin
      .from("expert_recordings")
      .select("id, audio_path, klassare_namn, inspelning_datum, wool_class, breed, transcript_full, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const withUrls = await Promise.all(
      (recs ?? []).map(async (r) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("expert-audio")
          .createSignedUrl(r.audio_path, 3600);
        const { count } = await supabaseAdmin
          .from("expert_observations")
          .select("id", { count: "exact", head: true })
          .eq("recording_id", r.id);
        return { ...r, audio_url: signed?.signedUrl ?? null, chunk_count: count ?? 0 };
      }),
    );
    return withUrls;
  });
