import { supabase } from "@/lib/supabase";

const ACTIVE_STATUSES = ["pending", "accepted"];

export type ConflictCheck = {
  date: string; // YYYY-MM-DD
  farmerId: string;
  shearerId: string;
  excludeBookingId?: string;
};

export type ConflictResult = {
  farmerConflict: boolean;
  shearerConflict: boolean;
  hasConflict: boolean;
};

/**
 * Detects whether the given farmer or shearer already has an active
 * (pending/accepted) booking on the requested date. Same date counts as
 * an overlapping clip slot since bookings are date-granular.
 */
export async function checkBookingConflict({
  date,
  farmerId,
  shearerId,
  excludeBookingId,
}: ConflictCheck): Promise<ConflictResult> {
  let query = supabase
    .from("bookings")
    .select("id, farmer_id, shearer_id")
    .eq("preferred_date", date)
    .in("status", ACTIVE_STATUSES)
    .or(`farmer_id.eq.${farmerId},shearer_id.eq.${shearerId}`);

  if (excludeBookingId) query = query.neq("id", excludeBookingId);

  const { data, error } = await query;
  if (error) {
    // Fail open — surface as no conflict, but log
    console.warn("conflict check failed", error);
    return { farmerConflict: false, shearerConflict: false, hasConflict: false };
  }

  const farmerConflict = (data ?? []).some((b) => b.farmer_id === farmerId);
  const shearerConflict = (data ?? []).some((b) => b.shearer_id === shearerId);

  return {
    farmerConflict,
    shearerConflict,
    hasConflict: farmerConflict || shearerConflict,
  };
}

export function conflictMessage(
  result: ConflictResult,
  lang: "sv" | "en",
): string | null {
  if (!result.hasConflict) return null;
  if (lang === "sv") {
    if (result.farmerConflict && result.shearerConflict)
      return "Både du och klipparen har redan en bokning detta datum.";
    if (result.farmerConflict)
      return "Du har redan en bokning detta datum. Välj ett annat datum.";
    return "Klipparen är redan bokad detta datum. Välj ett annat datum.";
  }
  if (result.farmerConflict && result.shearerConflict)
    return "Both you and the shearer already have a booking on this date.";
  if (result.farmerConflict)
    return "You already have a booking on this date. Pick another date.";
  return "The shearer is already booked on this date. Pick another date.";
}
