import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  tag_id: string | null;
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

export const Route = createFileRoute("/app/flock")({
  component: Flock,
});

function Flock() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [sheep, setSheep] = useState<Sheep[]>([]);
  const [editing, setEditing] = useState<Sheep | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!user) return;
    supabase
      .from("sheep")
      .select("id, name, tag_id, breed, breed_code, age_category, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSheep((data as Sheep[]) ?? []));
  };

  useEffect(load, [user]);

  const onSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("sheep")
      .update({
        name: editing.name?.trim() || null,
        tag_id: editing.tag_id?.trim() || null,
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
                  {s.name || s.tag_id || `🐑 ${s.id.slice(0, 6)}`}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.age_category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {breedLabel(s.breed_code, lang as "sv" | "en") || s.breed || ""}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditing(s)}
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
            <DialogTitle>
              {lang === "sv" ? "Redigera får" : "Edit sheep"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{lang === "sv" ? "Namn" : "Name"}</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "sv" ? "Öronnummer" : "Tag ID"}</Label>
                <Input
                  value={editing.tag_id ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, tag_id: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "sv" ? "Ras" : "Breed"}</Label>
                <Select
                  value={editing.breed_code ?? ""}
                  onValueChange={(v) =>
                    setEditing({ ...editing, breed_code: v })
                  }
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
                  onValueChange={(v) =>
                    setEditing({ ...editing, age_category: v })
                  }
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
                {saving ? (lang === "sv" ? "Sparar…" : "Saving…") : lang === "sv" ? "Spara" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
