import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Banknote, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calcBreakdown, formatSEK, WOOL_PRICE_SEK_PER_KG } from "@/lib/wool-pricing";

type Lot = {
  id: string;
  estimated_kg: number;
  actual_kg: number | null;
  status: string;
};

type Share = { percent: number; amount_sek: number | null; paid_at: string | null; shearer: { display_name: string } | null };

export function PaymentBreakdownCard({
  classificationId,
  woolClass,
}: {
  classificationId: string;
  woolClass: string | null;
}) {
  const [lot, setLot] = useState<Lot | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: lots } = await supabase
        .from("wool_lots")
        .select("id, estimated_kg, actual_kg, status")
        .eq("classification_id", classificationId)
        .limit(1);
      const l = (lots?.[0] as Lot) ?? null;
      if (cancelled) return;
      setLot(l);
      if (l) {
        const { data: shares } = await supabase
          .from("revenue_shares")
          .select("percent, amount_sek, paid_at, shearer:shearers(display_name)")
          .eq("wool_lot_id", l.id)
          .limit(1);
        if (!cancelled) setShare((shares?.[0] as unknown as Share) ?? null);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [classificationId]);

  if (!loaded) return null;
  if (!lot) {
    return (
      <Link
        to="/app/sell"
        className="block bg-card border border-dashed border-border rounded-2xl p-4 hover:border-primary/40 transition"
      >
        <div className="flex items-center gap-3">
          <div className="bg-secondary rounded-xl p-2">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Sälj denna ull</p>
            <p className="text-xs text-muted-foreground mt-0.5">Registrera kvantitet och välj leveranssätt.</p>
          </div>
          <span className="text-primary text-sm font-semibold">→</span>
        </div>
      </Link>
    );
  }

  const kg = Number(lot.actual_kg ?? lot.estimated_kg);
  const pct = share?.percent ?? 0;
  const b = calcBreakdown(woolClass, kg, pct);
  const known = b.pricePerKg > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Försäljning &amp; utbetalning</h3>
        <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
          {lot.status}
        </span>
      </div>

      {!known && (
        <p className="text-xs text-muted-foreground">
          Indikativt pris saknas för klass <strong>{woolClass ?? "?"}</strong>. Priset bestäms vid mottagning på Holma.
        </p>
      )}

      <div className="space-y-2 text-sm">
        <Row label="Mängd">{kg.toFixed(1)} kg</Row>
        <Row label={`Pris per kg${!known ? " (uppskattat)" : ""}`}>
          {known ? formatSEK(b.pricePerKg) : "—"}
        </Row>
        <Row label="Bruttointäkt" bold>{known ? formatSEK(b.gross) : "—"}</Row>
        {share && (
          <Row label={`Klipparens andel${share.shearer ? ` (${share.shearer.display_name})` : ""} · ${pct}%`}>
            {known ? `– ${formatSEK(b.shearerAmount)}` : "—"}
          </Row>
        )}
        <div className="border-t border-border pt-2 mt-2">
          <Row label="Du får" bold>{known ? formatSEK(b.ownerAmount) : "—"}</Row>
        </div>
      </div>

      {share?.paid_at ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
          ✓ Klipparens andel utbetald {new Date(share.paid_at).toLocaleDateString("sv-SE")}
        </p>
      ) : share ? (
        <p className="text-xs text-muted-foreground italic">
          Klipparens andel betalas ut automatiskt när ullen sålts.
        </p>
      ) : null}

      <p className="text-[10px] text-muted-foreground">
        Riktpriser: {Object.entries(WOOL_PRICE_SEK_PER_KG).map(([k, v]) => `${k} ${v}`).join(" · ")} kr/kg.
      </p>
    </div>
  );
}

function Row({ label, children, bold }: { label: string; children: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-muted-foreground ${bold ? "text-foreground font-semibold" : ""}`}>{label}</span>
      <span className={bold ? "font-bold" : ""}>{children}</span>
    </div>
  );
}
