// Indikativa priser per kg (SEK) per ullklass.
// Riktvärden — slutpriset bestäms av Holma vid mottagning.
export const WOOL_PRICE_SEK_PER_KG: Record<string, number> = {
  A: 65,
  B: 50,
  C: 38,
  D: 25,
  E: 15,
  F: 8,
};

export type PaymentBreakdown = {
  pricePerKg: number;
  kg: number;
  gross: number;
  shearerPct: number;
  shearerAmount: number;
  ownerAmount: number;
};

export function calcBreakdown(
  woolClass: string | null | undefined,
  kg: number,
  shearerPct: number,
): PaymentBreakdown {
  const pricePerKg = (woolClass && WOOL_PRICE_SEK_PER_KG[woolClass.toUpperCase()]) || 0;
  const gross = Math.round(pricePerKg * kg);
  const shearerAmount = Math.round((gross * shearerPct) / 100);
  return {
    pricePerKg,
    kg,
    gross,
    shearerPct,
    shearerAmount,
    ownerAmount: gross - shearerAmount,
  };
}

export const formatSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);
