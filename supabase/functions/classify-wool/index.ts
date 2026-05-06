// supabase/functions/classify-wool/index.ts
//
// Deploy with:
//   supabase functions deploy classify-wool --project-ref hebsejawtxdmumccvojn
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  --project-ref hebsejawtxdmumccvojn
//
// This function is called from the client via supabase.functions.invoke("classify-wool", ...)
// It receives { classification_id, image_urls[], metadata }, calls Claude Vision,
// parses the JSON, and updates the classifications row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WOOL_SYSTEM_PROMPT = `You are a wool classification assistant trained on the Svensk Ullstandard 2.0
(Swedish Wool Standard, Axfoundation 2025). You analyze photos of sheep wool
in its raw state on living sheep and classify it according to the standard.

You will receive:
- 2 or more photos of a sheep (typically a close-up of the wool and a full-body
  shot, sometimes a fiber-length reference)
- Optional metadata: breed, age category, months since last shearing

Your job:
1. Visually estimate the wool's quality type and class
2. Recommend whether the farmer should shear now or wait
3. Return a strict JSON response

# THE STANDARD (memorize)

Wool is divided into 8 quality types. Each has 1+ classes. Suffix "P" means
pigmented (any color other than white).

## Type M — Merinotyp (Merino)
- M1 / M1P: length >40mm, fineness <22µ, fine crimp, good elasticity, medulla <3%, VM <0.3%, negligible felting.

## Type F — Lantras Finullstyp
- F1 / F1P: length >40mm, fineness <27µ, fine crimp, good elasticity, medulla <3%, VM <0.3%.
- F2: white only, no length/strength req, fineness <27µ.

## Type C — Crossbredtyp
- C1 / C1P: length >70mm, fineness <38µ, clear crimp.
- C1L: length >100mm, fineness <38µ.
- C2: length 40-70mm, fineness <38µ.
- C3: length >40mm, fineness <38µ.
- C4: length >70mm, fineness <80µ.

## Type S — Stoppningstyp
- S1: length >40mm, white, Texel/Suffolk-like.
- S2P: length >40mm, pigmented.

## Type P — Lantras Pälstyp
- P1 / P1P: length >70mm, clear LUSTER, lamb character.
- P2 / P2P: length >70mm, adult sheep character.

## Type V — Lantras Vadmalstyp
- V1 / V1P: undercoat >40mm, guard hair >40mm.
- V2 / V2P: guard hair >40mm, light felting accepted.

## Type R — Lantras Ryatyp
- R1 / R1P: undercoat >40mm, guard hair >120mm, clear luster.
- R2 / R2P: guard hair >120mm, atypical/crossbreed.

## Type U — Belly/leg wool & wool with vegetable matter
- U1 / U1P, U2, U3, U4

# SHEAR-TIMING RULES
1. Pregnancy/lambing override: if within 4 weeks of lambing → "VÄNTA — klipp inte under sista månaden före lamning".
2. Length-based: below min length → "Vänta 1-2 månader". At min, could grow → "Vänta 2-4 veckor". At/above optimal → "Klipp nu". Felting → "Klipp omgående". Overlength → "Klipp omgående".
3. Seasonal default: if uncertain, "Vänta 2-4 veckor".

# PHOTO QUALITY
If unusable, set wool_class to null and explain in retake_reason_sv.

# OUTPUT FORMAT — ONLY JSON
{
  "wool_class": "C1",
  "wool_class_name_sv": "Crossbredtyp, vit, klass 1",
  "wool_class_name_en": "Crossbred type, white, class 1",
  "confidence": "high",
  "estimated_length_mm": 75,
  "estimated_fineness_micron": 35,
  "observed_color": "white",
  "observed_crimp": "clear",
  "observed_luster": "moderate",
  "felting": "none",
  "vegetable_matter": "low",
  "shear_recommendation": "shear_now",
  "weeks_until_optimal": 0,
  "recommendation_text_sv": "Klipp nu — ullen har optimal längd.",
  "recommendation_text_en": "Shear now — optimal length reached.",
  "reasoning_sv": "Ullen är ca 7-8 cm, vit, fri från VM, tydlig krusighet.",
  "photo_quality": "good",
  "needs_retake": false,
  "retake_reason_sv": null
}

Allowed values:
- confidence: "high" | "medium" | "low"
- observed_color: "white" | "pigmented" | "mixed"
- observed_crimp: "fine" | "clear" | "low" | "none"
- observed_luster: "high" | "moderate" | "low" | "none"
- felting: "none" | "light" | "heavy"
- vegetable_matter: "low" | "medium" | "high"
- shear_recommendation: "shear_now" | "shear_urgent" | "wait_short" | "wait_long" | "do_not_shear_lambing"
- photo_quality: "good" | "acceptable" | "poor"

Respond with ONLY the JSON object — no markdown fences, no commentary.`;

interface Payload {
  classification_id: string;
  image_urls: string[];
  metadata?: {
    breed?: string;
    age_category?: string;
    months_since_last_shear?: number;
    sheepName?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { classification_id, image_urls, metadata } = body;
  if (!classification_id || !Array.isArray(image_urls) || image_urls.length < 1) {
    return json({ error: "Missing classification_id or image_urls" }, 400);
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

  try {
    const userText = `Metadata:
Breed: ${metadata?.breed ?? "unknown"}
Age: ${metadata?.age_category ?? "unknown"}
Months since last shear: ${metadata?.months_since_last_shear ?? "unknown"}`;

    const content: any[] = image_urls.map((url) => ({
      type: "image",
      source: { type: "url", url },
    }));
    content.push({ type: "text", text: userText });

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 1500,
        system: WOOL_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`Anthropic error ${aiResp.status}: ${t}`);
    }

    const aiData = await aiResp.json();
    const textBlock = aiData.content?.find((b: any) => b.type === "text");
    if (!textBlock) throw new Error("No text content from AI");

    let raw = textBlock.text.trim();
    // Strip markdown fences if model added them
    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const result = JSON.parse(raw);

    await supabase
      .from("classifications")
      .update({
        status: "completed",
        wool_class: result.wool_class,
        wool_class_name_sv: result.wool_class_name_sv,
        wool_class_name_en: result.wool_class_name_en,
        confidence: result.confidence,
        estimated_length_mm: result.estimated_length_mm,
        estimated_fineness_micron: result.estimated_fineness_micron,
        observed_color: result.observed_color,
        observed_crimp: result.observed_crimp,
        observed_luster: result.observed_luster,
        felting: result.felting,
        vegetable_matter: result.vegetable_matter,
        shear_recommendation: result.shear_recommendation,
        weeks_until_optimal: result.weeks_until_optimal,
        recommendation_text_sv: result.recommendation_text_sv,
        recommendation_text_en: result.recommendation_text_en,
        reasoning_sv: result.reasoning_sv,
        photo_quality: result.photo_quality,
        needs_retake: result.needs_retake ?? false,
        retake_reason_sv: result.retake_reason_sv,
        raw_ai_response: aiData,
        completed_at: new Date().toISOString(),
      })
      .eq("id", classification_id);

    return json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("classifications")
      .update({ status: "failed", error_message: msg })
      .eq("id", classification_id);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
