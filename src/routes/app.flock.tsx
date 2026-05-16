import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, X, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { BREEDS, breedLabel } from "@/lib/breeds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Sheep = {
  id: string;
  name: string | null;
  ear_tag_id: string | null;
  breed: string | null;
  breed_code: string | null;
  age_category: string | null;
  created_at: string;
};

const AGE_CATEGORIES = [
  { value: "lamb", label_sv: "Lamm", label_en: "Lamb" },
  { value: "yearling", label_sv: "Årsgammal", label_en: "Yearling" },
  { value: "adult", label_sv: "Vuxen", label_en: "Adult" },
];

// Split full ear tag (e.g. "SE-12345-678") into the trailing individual number.
export function individualFromEarTag(ear: string | null | undefined): string {
  if (!ear) return "";
  const parts = ear.split("-");
  return parts[parts.length - 1] ?? "";
}

export function buildEarTag(ppn: string | null | undefined, individual: string): string | null {
  const ind = individual.trim();
  if (!ind) return null;
  if (!ppn) return ind;
  return `SE-${ppn}-${ind}`;
}

export const Route = createFileRoute("/app/flock")({
  component: Flock,
});

function Flock() {
  const { t, lang } = useTranslation();
  const { user, profile } = useAuth();
  const [sheep, setSheep] = useState<Sheep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Sheep | null>(null);
  const [individual, setIndividual] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [latest, setLatest] = useState<Record<string, { classId: string; thumb: string | null }>>({});

  const ppn = profile?.production_place_number ?? null;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sheep")
      .select("id, name, ear_tag_id, breed, breed_code, age_category, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data as unknown as Sheep[]) ?? [];
    setSheep(list);
    setLoaded(true);

    // Fetch latest classification per sheep for thumbnails + quick-view link
    const ids = list.map((s) => s.id);
    if (ids.length) {
      const { data: cls } = await supabase
        .from("classifications")
        .select("id, sheep_id, photo_urls, created_at")
        .eq("user_id", user.id)
        .in("sheep_id", ids)
        .order("created_at", { ascending: false });
      const byS: Record<string, { classId: string; thumb: string | null }> = {};
      for (const c of (cls ?? []) as Array<{ id: string; sheep_id: string; photo_urls: string[] | null }>) {
        if (!c.sheep_id || byS[c.sheep_id]) continue;
        byS[c.sheep_id] = { classId: c.id, thumb: null };
        const first = c.photo_urls?.[0];
        if (first) {
          supabase.storage.from("sheep-photos").createSignedUrl(first, 3600).then(({ data: s }) => {
            if (s?.signedUrl) {
              setLatest((prev) => ({ ...prev, [c.sheep_id]: { ...(prev[c.sheep_id] ?? { classId: c.id, thumb: null }), thumb: s.signedUrl } }));
            }
          });
        }
      }
      setLatest(byS);
    } else {
      setLatest({});
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user]);

  const { pull, refreshing, threshold } = usePullToRefresh({
    onRefresh: async () => { haptic("tap"); await load(); },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sheep;
    return sheep.filter((s) => {
      return (
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.ear_tag_id ?? "").toLowerCase().includes(q) ||
        (s.breed ?? "").toLowerCase().includes(q) ||
        (s.breed_code ?? "").toLowerCase().includes(q) ||
        (s.age_category ?? "").toLowerCase().includes(q)
      );
    });
  }, [sheep, query]);

  const openEdit = (s: Sheep) => {
    setEditing(s);
    setIndividual(individualFromEarTag(s.ear_tag_id));
  };

  const onSave = async () => {
    if (!editing) return;
    setSaving(true);
    const ear = buildEarTag(ppn, individual);
    const { error } = await supabase
      .from("sheep")
      .update({
        name: editing.name?.trim() || null,
        ear_tag_id: ear,
        breed_code: editing.breed_code,
        breed: editing.breed_code ? breedLabel(editing.breed_code, "sv") : null,
        age_category: editing.age_category,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t({ sv: "Sparat", en: "Saved" }));
    setEditing(null);
    load();
  };

  const onDelete = async () => {
    if (!editing) return;
    if (!confirm(t({ sv: "Ta bort detta får?", en: "Delete this sheep?" }))) return;
    const { error } = await supabase.from("sheep").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t({ sv: "Borttaget", en: "Deleted" }));
    setEditing(null);
    load();
  };

  const previewTag = useMemo(() => buildEarTag(ppn, individual), [ppn, individual]);

  return (
    <div className="space-y-3 pt-2">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />
      <PageHeader
        back={false}
        title={t("flock")}
        action={
          sheep.length > 0 ? (
            <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {sheep.length}
            </span>
          ) : undefined
        }
      />

      {sheep.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t({ sv: "Sök på namn, EID, ras...", en: "Search name, EID, breed..." })}
              className="h-12 pl-9 pr-9 rounded-2xl bg-card"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t({ sv: "Rensa", en: "Clear" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!loaded ? (
        <>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </>
      ) : sheep.length === 0 ? (
        <EmptyState
          emoji="🐑"
          title={t({ sv: "Din flock är tom", en: "Your flock is empty" })}
          description={
            t({ sv: "När du klassificerar ett får sparas det automatiskt här. Kom igång med din första bild.", en: "Sheep you classify show up here automatically. Start with your first photo." })}
          action={
            <Button asChild className="rounded-xl">
              <Link to="/app/classify" onClick={() => haptic("tap")}>
                {t({ sv: "Ny klassificering", en: "New classification" })}
              </Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">
          {t({ sv: `Inga får matchar "${query}"`, en: `No sheep match "${query}"` })}
        </p>
      ) : (
        filtered.map((s) => {
          const lat = latest[s.id];
          const card = (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
                {lat?.thumb ? (
                  <img src={lat.thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground/60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold truncate">
                    {s.ear_tag_id ? (
                      <>
                        <span className="font-mono">{s.ear_tag_id}</span>
                        {s.name && <span className="text-muted-foreground"> · {s.name}</span>}
                      </>
                    ) : (
                      <>
                        {s.name || `🐑 ${s.id.slice(0, 6)}`}{" "}
                        <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">
                          {t({ sv: "Ej märkt än", en: "Not tagged yet" })}
                        </span>
                      </>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">{s.age_category}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {breedLabel(s.breed_code, lang as "sv" | "en") || s.breed || ""}
                </p>
                {!lat && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {t({ sv: "Inga bilder än", en: "No photos yet" })}
                  </p>
                )}
              </div>
            </div>
          );
          return (
            <div
              key={s.id}
              className="bg-card border border-border rounded-2xl p-3 shadow-soft flex items-center justify-between gap-2"
            >
              {lat ? (
                <Link
                  to="/app/result/$id"
                  params={{ id: lat.classId }}
                  className="flex-1 min-w-0 active:scale-[0.99] transition"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openEdit(s)}
                aria-label={t({ sv: "Redigera", en: "Edit" })}
              >
                <Pencil />
              </Button>
            </div>
          );
        })
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t({ sv: "Redigera får", en: "Edit sheep" })}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t({ sv: "Smeknamn (valfritt)", en: "Nickname (optional)" })}</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder={t({ sv: "T.ex. Bertil", en: "e.g. Bertil" })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t({ sv: "Öronmärkesnummer (EID)", en: "Ear tag number (EID)" })}
                </Label>
                {!ppn && (
                  <div className="text-xs bg-accent/20 border border-accent/40 rounded-lg p-2 text-accent-foreground">
                    {t({ sv: "⚠️ Ange ditt produktionsplatsnummer i din profil för att märka får med EID-nummer.", en: "⚠️ Add your production place number in your profile to tag sheep with EID numbers." })}
                  </div>
                )}
                <div className="flex items-center gap-1 font-mono text-sm">
                  <span className="px-2 py-2 rounded-md bg-muted text-muted-foreground">SE-</span>
                  <span className="px-2 py-2 rounded-md bg-muted text-muted-foreground min-w-[60px] text-center">
                    {ppn || "—"}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <Input
                    inputMode="numeric"
                    value={individual}
                    onChange={(e) => setIndividual(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                    placeholder="678"
                    className="font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t({ sv: "Det 3–4-siffriga numret som finns på fårets öronmärke.", en: "The 3–4 digit number shown on the sheep's ear tag." })}
                </p>
                {previewTag && (
                  <p className="text-xs font-mono text-primary">→ {previewTag}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    toast.message(t({ sv: "Bluetooth-skanning kommer snart", en: "Bluetooth scanning coming soon" }))
                  }
                >
                  {t({ sv: "Skanna öronmärke 📡", en: "Scan ear tag 📡" })}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>{t({ sv: "Ras", en: "Breed" })}</Label>
                <Select
                  value={editing.breed_code ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, breed_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t({ sv: "Välj ras", en: "Select breed" })} />
                  </SelectTrigger>
                  <SelectContent>
                    {BREEDS.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {lang === "en" ? b.name_en : b.name_sv}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t({ sv: "Ålder", en: "Age" })}</Label>
                <Select
                  value={editing.age_category ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, age_category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t({ sv: "Välj ålder", en: "Select age" })} />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_CATEGORIES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {lang === "en" ? a.label_en : a.label_sv}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button variant="destructive" onClick={onDelete} disabled={saving}>
              <Trash2 /> {t({ sv: "Ta bort", en: "Delete" })}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                {t({ sv: "Avbryt", en: "Cancel" })}
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving
                  ? t({ sv: "Sparar…", en: "Saving…" }): t({ sv: "Spara", en: "Save" })}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
