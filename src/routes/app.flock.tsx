import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
  const [editing, setEditing] = useState<Sheep | null>(null);
  const [individual, setIndividual] = useState("");
  const [saving, setSaving] = useState(false);

  const ppn = profile?.production_place_number ?? null;

  const load = () => {
    if (!user) return;
    supabase
      .from("sheep")
      .select("id, name, ear_tag_id, breed, breed_code, age_category, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSheep((data as unknown as Sheep[]) ?? []));
  };

  useEffect(load, [user]);

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
    toast.success(lang === "sv" ? "Sparat" : "Saved");
    setEditing(null);
    load();
  };

  const onDelete = async () => {
    if (!editing) return;
    if (!confirm(lang === "sv" ? "Ta bort detta får?" : "Delete this sheep?")) return;
    const { error } = await supabase.from("sheep").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "sv" ? "Borttaget" : "Deleted");
    setEditing(null);
    load();
  };

  const previewTag = useMemo(() => buildEarTag(ppn, individual), [ppn, individual]);

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-xl font-bold text-primary">{t("flock")}</h2>
      {sheep.length === 0 ? (
        <p className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground text-sm">
          {lang === "sv"
            ? "Sparade får visas här efter en klassificering."
            : "Saved sheep appear here after a classification."}
        </p>
      ) : (
        sheep.map((s) => (
          <div
            key={s.id}
            className="bg-card border border-border rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3"
          >
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
                        {lang === "sv" ? "Ej märkt än" : "Not tagged yet"}
                      </span>
                    </>
                  )}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">{s.age_category}</span>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {breedLabel(s.breed_code, lang as "sv" | "en") || s.breed || ""}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openEdit(s)}
              aria-label={lang === "sv" ? "Redigera" : "Edit"}
            >
              <Pencil />
            </Button>
          </div>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "sv" ? "Redigera får" : "Edit sheep"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{lang === "sv" ? "Smeknamn (valfritt)" : "Nickname (optional)"}</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder={lang === "sv" ? "T.ex. Bertil" : "e.g. Bertil"}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  {lang === "sv" ? "Öronmärkesnummer (EID)" : "Ear tag number (EID)"}
                </Label>
                {!ppn && (
                  <div className="text-xs bg-accent/20 border border-accent/40 rounded-lg p-2 text-accent-foreground">
                    {lang === "sv"
                      ? "⚠️ Ange ditt produktionsplatsnummer i din profil för att märka får med EID-nummer."
                      : "⚠️ Add your production place number in your profile to tag sheep with EID numbers."}
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
                  {lang === "sv"
                    ? "Det 3–4-siffriga numret som finns på fårets öronmärke."
                    : "The 3–4 digit number shown on the sheep's ear tag."}
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
                    toast.message(lang === "sv" ? "Bluetooth-skanning kommer snart" : "Bluetooth scanning coming soon")
                  }
                >
                  {lang === "sv" ? "Skanna öronmärke 📡" : "Scan ear tag 📡"}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>{lang === "sv" ? "Ras" : "Breed"}</Label>
                <Select
                  value={editing.breed_code ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, breed_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={lang === "sv" ? "Välj ras" : "Select breed"} />
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
                <Label>{lang === "sv" ? "Ålder" : "Age"}</Label>
                <Select
                  value={editing.age_category ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, age_category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={lang === "sv" ? "Välj ålder" : "Select age"} />
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
              <Trash2 /> {lang === "sv" ? "Ta bort" : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                {lang === "sv" ? "Avbryt" : "Cancel"}
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving
                  ? lang === "sv"
                    ? "Sparar…"
                    : "Saving…"
                  : lang === "sv"
                    ? "Spara"
                    : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
