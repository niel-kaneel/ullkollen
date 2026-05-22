// Svensk Ullstandard 2.0 — class ladders per quality type.
// Ordered from BEST (index 0) to WORST. "One step lower" = next index.
// These are explicit lookup tables — never let the AI infer adjacency.
// Pigmented variants (suffix P) sit one notch below the white variant at the
// same numeric level: e.g. P1 → P1P → P2 → P2P.

export type Confidence = "high" | "medium" | "low" | string | null | undefined;

const LADDERS: string[][] = [
  ["M1", "M1P"],
  ["F1", "F1P", "F2"],
  ["C1", "C1P", "C1L", "C2", "C3", "C4"],
  ["S1", "S2P"],
  ["P1", "P1P", "P2", "P2P"],
  ["V1", "V1P", "V2", "V2P"],
  ["R1", "R1P", "R2", "R2P"],
  ["U1", "U1P", "U2", "U3P", "U4P"],
  // Legacy A–F pricing ladder (used by indikativa priser)
  ["A", "B", "C", "D", "E", "F"],
];

function findLadder(cls: string): { ladder: string[]; idx: number } | null {
  const up = cls.toUpperCase();
  for (const ladder of LADDERS) {
    const idx = ladder.indexOf(up);
    if (idx !== -1) return { ladder, idx };
  }
  return null;
}

export type ClassRange = {
  likely: string;
  /** floor === likely when the likely class is already the lowest in its track */
  floor: string;
  isLowest: boolean;
  /** widened to 2 steps because confidence was low */
  widened: boolean;
  /** collapsed to a single class because confidence is high + tactile confirmed */
  collapsed: boolean;
};

/**
 * Derive a conservative class range from the AI's likely prediction.
 *
 * Rules:
 *  - normal:   floor = one step lower
 *  - low conf: floor = two steps lower (widened)
 *  - high conf + tactile confirmed: collapse to single class
 *  - already at the bottom of its track: floor === likely, isLowest=true
 */
export function getClassRange(
  likely: string | null | undefined,
  confidence: Confidence,
  tactileConfirmed = false,
): ClassRange | null {
  if (!likely) return null;
  const up = likely.toUpperCase();
  const hit = findLadder(up);
  if (!hit) {
    // Unknown ladder — return as-is (no floor below it).
    return { likely: up, floor: up, isLowest: true, widened: false, collapsed: false };
  }
  const { ladder, idx } = hit;

  if (confidence === "high" && tactileConfirmed) {
    return { likely: up, floor: up, isLowest: idx === ladder.length - 1, widened: false, collapsed: true };
  }

  if (idx === ladder.length - 1) {
    return { likely: up, floor: up, isLowest: true, widened: false, collapsed: false };
  }

  const steps = confidence === "low" ? 2 : 1;
  const floorIdx = Math.min(idx + steps, ladder.length - 1);
  return {
    likely: up,
    floor: ladder[floorIdx],
    isLowest: false,
    widened: steps === 2,
    collapsed: false,
  };
}

/** True if a user correction landed outside the conservative range (off by >1 step). */
export function isOutOfRangeCorrection(
  range: ClassRange | null,
  corrected: string | null | undefined,
): boolean {
  if (!range || !corrected) return false;
  const c = corrected.toUpperCase();
  if (c === range.likely || c === range.floor) return false;
  const hit = findLadder(c);
  const likelyHit = findLadder(range.likely);
  if (!hit || !likelyHit || hit.ladder !== likelyHit.ladder) return true;
  return Math.abs(hit.idx - likelyHit.idx) > 1;
}

// Class → human-readable names per Svensk Ullstandard 2.0.
// Used to auto-update descriptions when a user edits the class code.
export const WOOL_CLASS_NAMES: Record<string, { sv: string; en: string }> = {
  M1:  { sv: "Merinotyp, vit, klass 1",                        en: "Merino type, white, class 1" },
  M1P: { sv: "Merinotyp, pigmenterad, klass 1",                en: "Merino type, pigmented, class 1" },
  F1:  { sv: "Lantras Finullstyp, vit, klass 1",               en: "Native Finewool type, white, class 1" },
  F1P: { sv: "Lantras Finullstyp, pigmenterad, klass 1",       en: "Native Finewool type, pigmented, class 1" },
  F2:  { sv: "Lantras Finullstyp, vit, klass 2",               en: "Native Finewool type, white, class 2" },
  C1:  { sv: "Crossbredtyp, vit, klass 1",                     en: "Crossbred type, white, class 1" },
  C1P: { sv: "Crossbredtyp, pigmenterad, klass 1",             en: "Crossbred type, pigmented, class 1" },
  C1L: { sv: "Crossbredtyp, vit, klass 1 (helårsfäll)",        en: "Crossbred type, white, class 1 (full-year fleece)" },
  C2:  { sv: "Crossbredtyp, klass 2",                          en: "Crossbred type, class 2" },
  C3:  { sv: "Crossbredtyp, klass 3",                          en: "Crossbred type, class 3" },
  C4:  { sv: "Crossbredtyp, klass 4 (grov)",                   en: "Crossbred type, class 4 (coarse)" },
  S1:  { sv: "Stoppningstyp, vit, klass 1",                    en: "Stuffing type, white, class 1" },
  S2P: { sv: "Stoppningstyp, pigmenterad, klass 2",            en: "Stuffing type, pigmented, class 2" },
  P1:  { sv: "Lantras Pälstyp, vit, lamm, klass 1",            en: "Native Pelt type, white, lamb, class 1" },
  P1P: { sv: "Lantras Pälstyp, pigmenterad, lamm, klass 1",    en: "Native Pelt type, pigmented, lamb, class 1" },
  P2:  { sv: "Lantras Pälstyp, vit, vuxen, klass 2",           en: "Native Pelt type, white, adult, class 2" },
  P2P: { sv: "Lantras Pälstyp, pigmenterad, vuxen, klass 2",   en: "Native Pelt type, pigmented, adult, class 2" },
  V1:  { sv: "Lantras Vadmalstyp, vit, klass 1",               en: "Native Wadmal type, white, class 1" },
  V1P: { sv: "Lantras Vadmalstyp, pigmenterad, klass 1",       en: "Native Wadmal type, pigmented, class 1" },
  V2:  { sv: "Lantras Vadmalstyp, vit, klass 2",               en: "Native Wadmal type, white, class 2" },
  V2P: { sv: "Lantras Vadmalstyp, pigmenterad, klass 2",       en: "Native Wadmal type, pigmented, class 2" },
  R1:  { sv: "Lantras Ryatyp, vit, klass 1",                   en: "Native Rya type, white, class 1" },
  R1P: { sv: "Lantras Ryatyp, pigmenterad, klass 1",           en: "Native Rya type, pigmented, class 1" },
  R2:  { sv: "Lantras Ryatyp, vit, klass 2 (korsning)",        en: "Native Rya type, white, class 2 (cross)" },
  R2P: { sv: "Lantras Ryatyp, pigmenterad, klass 2 (korsning)", en: "Native Rya type, pigmented, class 2 (cross)" },
  U1:  { sv: "Buk-/lårull, vit, klass 1 (mattgarn)",           en: "Belly/leg wool, white, class 1 (rug yarn)" },
  U1P: { sv: "Buk-/lårull, pigmenterad, klass 1 (mattgarn)",   en: "Belly/leg wool, pigmented, class 1 (rug yarn)" },
  U2:  { sv: "Buk-/lårull, vit, klass 2 (teknisk filt)",       en: "Belly/leg wool, white, class 2 (technical felt)" },
  U3P: { sv: "Buk-/lårull, pigmenterad, klass 3 (pellets)",    en: "Belly/leg wool, pigmented, class 3 (pellets)" },
  U4P: { sv: "Buk-/lårull, pigmenterad, klass 4 (pellets)",    en: "Belly/leg wool, pigmented, class 4 (pellets)" },
};

export function namesForClass(cls: string | null | undefined): { sv: string; en: string } | null {
  if (!cls) return null;
  return WOOL_CLASS_NAMES[cls.toUpperCase()] ?? null;
}
