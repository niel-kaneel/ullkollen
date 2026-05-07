import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "google/gemini-2.5-flash";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

# THE STANDARD

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

# BREED → LIKELY WOOL TYPE HINTS (use as guidance, not a hard rule)

If breed metadata is provided, use it as a prior on the likely classification:
- Gotlandsfår        → likely P1/P1P (lustrous curly pelt)
- Finullsfår         → likely F1/F1P (fine, fine-crimped)
- Ryafår             → likely R1/R1P (long lustrous guard hair, fine undercoat)
- Gutefår            → mixed, often U (primitive double-coat with kemp)
- Dalapälsfår        → P type (often white pelt with corkscrew-curl on lambs)
- Helsingefår        → V (vadmal type, double-coated)
- Värmlandsfår       → mixed, often V
- Texel / Suffolk    → S (stuffing type, short lean wool)
- Leicester / Dorset → C (crossbred, longer wool)
- Jämtlandsfår       → M or F (merino-influenced fineness)

Always trust the visual evidence over the breed hint. The breed hint is a
prior probability, not a verdict — many sheep don't match their breed's
typical wool type, and crossbreeds are common.

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

const InputSchema = z.object({
  image_urls: z.array(z.string().url()).min(1).max(3),
  metadata: z
    .object({
      breed: z.string().optional(),
      age_category: z.string().optional(),
      months_since_last_shear: z.number().optional(),
      sheepName: z.string().optional(),
    })
    .optional(),
});

const ResultSchema = z.object({
  wool_class: z.string().nullable().optional(),
  wool_class_name_sv: z.string().nullable().optional(),
  wool_class_name_en: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  estimated_length_mm: z.number().nullable().optional(),
  estimated_fineness_micron: z.number().nullable().optional(),
  observed_color: z.enum(["white", "pigmented", "mixed"]).nullable().optional(),
  observed_crimp: z.enum(["fine", "clear", "low", "none"]).nullable().optional(),
  observed_luster: z.enum(["high", "moderate", "low", "none"]).nullable().optional(),
  felting: z.enum(["none", "light", "heavy"]).nullable().optional(),
  vegetable_matter: z.enum(["low", "medium", "high"]).nullable().optional(),
  shear_recommendation: z
    .enum(["shear_now", "shear_urgent", "wait_short", "wait_long", "do_not_shear_lambing"])
    .nullable()
    .optional(),
  weeks_until_optimal: z.number().nullable().optional(),
  recommendation_text_sv: z.string().nullable().optional(),
  recommendation_text_en: z.string().nullable().optional(),
  reasoning_sv: z.string().nullable().optional(),
  photo_quality: z.enum(["good", "acceptable", "poor"]).nullable().optional(),
  needs_retake: z.boolean().nullable().optional(),
  retake_reason_sv: z.string().nullable().optional(),
});

type WoolResult = z.infer<typeof ResultSchema>;

function parseJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI-svaret saknade JSON.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeResult(result: WoolResult) {
  return {
    wool_class: result.wool_class ?? null,
    wool_class_name_sv: result.wool_class_name_sv ?? null,
    wool_class_name_en: result.wool_class_name_en ?? null,
    confidence: result.confidence ?? "low",
    estimated_length_mm: result.estimated_length_mm ?? null,
    estimated_fineness_micron: result.estimated_fineness_micron ?? null,
    observed_color: result.observed_color ?? null,
    observed_crimp: result.observed_crimp ?? null,
    observed_luster: result.observed_luster ?? null,
    felting: result.felting ?? null,
    vegetable_matter: result.vegetable_matter ?? null,
    shear_recommendation: result.shear_recommendation ?? "wait_short",
    weeks_until_optimal: result.weeks_until_optimal ?? null,
    recommendation_text_sv: result.recommendation_text_sv ?? null,
    recommendation_text_en: result.recommendation_text_en ?? null,
    reasoning_sv: result.reasoning_sv ?? null,
    photo_quality: result.photo_quality ?? "acceptable",
    needs_retake: result.needs_retake ?? !result.wool_class,
    retake_reason_sv: result.retake_reason_sv ?? null,
  };
}

export const classifyWool = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI-tjänsten saknar konfiguration.");
    }

    const userText = `Metadata:
Breed: ${data.metadata?.breed ?? "unknown"}
Age: ${data.metadata?.age_category ?? "unknown"}
Months since last shear: ${data.metadata?.months_since_last_shear ?? "unknown"}`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: WOOL_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              ...data.image_urls.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`Wool AI request failed: ${response.status} ${details}`);
      throw new Error("AI-analysen kunde inte slutföras.");
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawText = payload.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("AI-svaret var tomt.");
    }

    const parsed = ResultSchema.parse(parseJsonObject(rawText));

    return {
      result: normalizeResult(parsed),
      raw_ai_response: {
        provider: "lovable-ai-gateway",
        model: MODEL,
        content: rawText,
      },
    };
  });