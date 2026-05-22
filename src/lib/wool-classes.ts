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
