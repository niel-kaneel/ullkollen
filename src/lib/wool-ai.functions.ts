import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Use the strongest multimodal model available — wool classification
// rewards careful visual reasoning over speed.
const MODEL = "google/gemini-2.5-pro";
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

# THE STANDARD (Svensk Ullstandard 2.0, Axfoundation 2025)

Wool is divided into 8 quality types. Each has 1+ classes. Suffix "P" means
pigmented (any color other than white). Use the EXACT thresholds below.

## Type M — Merinotyp
- M1 / M1P: length ≥40mm, fineness ≤22µ, fine crimp, good elasticity, medulla ≤3%, VM ≤0.3%, negligible felting. Fina garner, hudnära.

## Type F — Lantras Finullstyp
- F1 / F1P: length ≥40mm, fineness ≤27µ, fine crimp, good elasticity, medulla ≤3%, VM ≤0.3%. Spinnbar.
- F2: white only, no length/strength req, fineness ≤27µ. Otypisk godtas.

## Type C — Crossbredtyp
- C1 / C1P: length ≥70mm, fineness ≤38µ, clear crimp, medulla ≤3%, VM ≤0.3%.
- C1L: length ≥100mm, fineness ≤38µ, helårsfäll. Kard-/kamgarn, möbeltyg.
- C2: length 40–70mm, fineness ≤38µ. Kan blandas med C1 till vadmalstyg.
- C3: length <40mm, fineness ≤38µ.
- C4: length ≥70mm, fineness ≤80µ, märg ≤10%, VM ≤0.7%, lätt filtning godtas. Möbeltyg.

## Type S — Stoppningstyp (Texel/Suffolk-liknande)
- S1: length ≥40mm, white, mycket god spänst, märg ≤3%, VM ≤0.3%. Stoppning.
- S2P: length ≥40mm, pigmented, märg ≤10%, VM ≤0.7%. Isolering, stoppning.

## Type P — Lantras Pälstyp (Gotland, Dalapäls, Svärdsjö m.fl.)
- P1 / P1P: length ≥70mm, fineness ≤60µ, clear LUSTER, lamb character, medulla ≤3%, VM ≤0.3%. Glansiga, tunnare garner.
- P2 / P2P: length ≥70mm, fineness ≤60µ, clear luster, adult sheep character.

## Type V — Lantras Vadmalstyp
- V1 / V1P: undercoat ≥40mm (≤25µ), guard hair ≥40mm (≤60µ), medulla ≤3%, VM ≤1.0%. Vårull/vadmalsull, tovningsbar.
- V2 / V2P: guard hair ≥40mm, märg godtas, VM ≤1.0%, lätt filtning godtas. Grov päls/allmoge, kypert, tweed.

## Type R — Lantras Ryatyp
- R1 / R1P: undercoat ≥40mm (≤25µ), guard hair ≥120mm (≤60µ), clear luster, medulla ≤3%, VM ≤0.3%, ej genomsydd lock. Möbeltyg, bildvävsgarn.
- R2 / R2P: undercoat ≥40mm, guard hair ≥120mm (≤90µ), märg godtas, VM ≤1.0%, lätt filtning godtas. Korsningar. Mattgarn.

## Type U — Buk-/lårull och ull med vegetabiliskt material
- U1 / U1P: length ≥40mm, VM ≤10%, lätt filtning godtas. Mattgarn.
- U2: white, length <40mm. Teknisk filt.
- U3P: pigmented, no length req, kraftigt märghaltig, hög VM eller urinbränd. Pellets.
- U4P: no length req, hårdfiltad ull eller Dorperfäll. Pellets.

# VM-trösklar
- låg ≤0,3 % | medium ≤0,7 % | hög ≤1 %.

# SHEAR-TIMING RULES
1. Pregnancy/lambing override: NEVER shear within the last month before lambing → "VÄNTA — klipp inte under sista månaden före lamning". Klipp aldrig under digivning eller sjukdom.
2. Två klippningar per år föredras; en klippning per år ger längre fiber men ofta för tovig och skräpig för textil.
3. Bra regel: klipp innan betäckning OCH före lamning.
4. Length-based: under min → "Vänta 1-2 månader". Vid min, växer → "Vänta 2-4 veckor". Vid/över optimum → "Klipp nu". Filtning → "Klipp omgående". Överlängd → "Klipp omgående".
5. Vid osäkerhet: "Vänta 2-4 veckor".

# BREED → LIKELY WOOL TYPE HINTS (guidance, not a hard rule)

- Gotlandsfår   → P1/P1P (lustrous curly pelt)
- Finullsfår    → F1/F1P (fine, fine-crimped)
- Ryafår        → R1/R1P (long lustrous guard hair, fine undercoat)
- Gutefår       → mixed, often U or V2P
- Dalapälsfår   → P (white pelt, corkscrew-curl on lambs); also possible R
- Svärdsjöfår   → F or P
- Helsingefår   → V (vadmal, double-coated)
- Värmlandsfår  → V1/V2; some rya-type → R2
- Gestrikefår   → V2 (allmoge, grov)
- Texel/Suffolk → S (stuffing type)
- Leicester/Dorset → C (crossbred); Leicester also possible V2
- Jämtlandsfår  → M or F (merino-influenced)
- Dorperfår     → U4P (sheds, hårdfiltad)

Always trust the visual evidence over the breed hint. Crossbreeds are common.

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

    // Aggregate prior knowledge from all past classifications: for the
    // user's breed, what wool classes have other sheep been graded as?
    let priorBlock = "";
    try {
      const { data: stats } = await supabaseAdmin.rpc("breed_class_stats");
      if (stats && Array.isArray(stats)) {
        const breed = data.metadata?.breed;
        const relevant = breed
          ? (stats as Array<{ breed_code: string; wool_class: string; n: number }>).filter(
              (r) => r.breed_code === breed,
            )
          : [];
        if (relevant.length) {
          const total = relevant.reduce((s, r) => s + Number(r.n), 0);
          const top = relevant
            .slice(0, 5)
            .map((r) => `${r.wool_class} (${Math.round((Number(r.n) / total) * 100)}%)`)
            .join(", ");
          priorBlock = `\n\nLEARNED PRIOR (from ${total} past classifications of breed "${breed}"): most common classes are ${top}. Use as a soft prior — visual evidence still wins.`;
        }
      }
    } catch {
      // best-effort, never fail classification because of stats
    }

    const userText = `Metadata:
Breed: ${data.metadata?.breed ?? "unknown"}
Age: ${data.metadata?.age_category ?? "unknown"}
Months since last shear: ${data.metadata?.months_since_last_shear ?? "unknown"}${priorBlock}`;

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