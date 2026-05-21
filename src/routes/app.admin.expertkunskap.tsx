import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Upload, Trash2, Save, RefreshCw, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import {
  transcribeRecording,
  saveRecording,
  deleteRecording,
  listExpertRecordings,
} from "@/lib/expert.functions";

export const Route = createFileRoute("/app/admin/expertkunskap")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: ExpertKunskap,
});

const WOOL_CLASSES = [
  "M1", "M1P", "F1", "F1P", "F2",
  "C1", "C1P", "C1L", "C2", "C3", "C4",
  "S1", "S2P",
  "P1", "P1P", "P2", "P2P",
  "V1", "V1P", "V2", "V2P",
  "R1", "R1P", "R2", "R2P",
  "U1", "U1P", "U2", "U3P", "U4P",
];

const BREEDS = [
  "Gotlandsfår", "Värmlandsfår", "Roslagsfår", "Rydfår", "Gutefår",
  "Finullsfår", "Dala pälsfår", "Ryafår", "Svärdsjöfår", "Helsingefår",
  "Jämtlandsfår", "Texel", "Suffolk", "Leicester", "Dorset", "Dorperfår", "Annat",
];

const FIBER_TAGS = [
  "mjukhet", "krusning", "fetthalt", "stickighet", "glans",
  "lockstruktur", "styrka", "märghår", "bottenull",
];

type Recording = {
  id: string;
  audio_path: string;
  klassare_namn: string | null;
  inspelning_datum: string | null;
  wool_class: string | null;
  breed: string | null;
  transcript_full: string | null;
  created_at: string;
  audio_url: string | null;
  chunk_count: number;
};

function ExpertKunskap() {
  const { isAdmin, loading } = useAuth();
  const transcribe = useServerFn(transcribeRecording);
  const save = useServerFn(saveRecording);
  const del = useServerFn(deleteRecording);
  const list = useServerFn(listExpertRecordings);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Edit form state (also reused for new uploads)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [klassareNamn, setKlassareNamn] = useState("");
  const [inspelningDatum, setInspelningDatum] = useState("");
  const [woolClass, setWoolClass] = useState<string>("");
  const [breed, setBreed] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState<"idle" | "uploading" | "transcribing" | "saving" | "deleting">("idle");

  const reset = () => {
    setEditingId(null);
    setAudioPath(null);
    setAudioPreviewUrl(null);
    setKlassareNamn("");
    setInspelningDatum("");
    setWoolClass("");
    setBreed("");
    setTranscript("");
    setTags([]);
  };

  const loadList = async () => {
    setLoadingList(true);
    try {
      const rows = await list();
      setRecordings(rows as Recording[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte ladda inspelningar.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin]);

  const handleUpload = async (file: File) => {
    setBusy("uploading");
    try {
      const ext = file.name.split(".").pop() || "m4a";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("expert-audio").upload(path, file, {
        contentType: file.type || "audio/m4a",
      });
      if (error) throw error;
      setAudioPath(path);
      const { data: signed } = await supabase.storage.from("expert-audio").createSignedUrl(path, 3600);
      setAudioPreviewUrl(signed?.signedUrl ?? null);

      setBusy("transcribing");
      const { transcript: tx } = await transcribe({ data: { audio_path: path } });
      setTranscript(tx);
      toast.success("Transkribering klar — granska och korrigera ord.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uppladdning misslyckades.");
    } finally {
      setBusy("idle");
    }
  };

  const handleSave = async () => {
    if (!audioPath || !transcript.trim()) {
      toast.error("Ladda upp ljud och se till att transkriptionen inte är tom.");
      return;
    }
    setBusy("saving");
    try {
      await save({
        data: {
          id: editingId ?? undefined,
          audio_path: audioPath,
          klassare_namn: klassareNamn || null,
          inspelning_datum: inspelningDatum || null,
          wool_class: woolClass || null,
          breed: breed || null,
          transcript_full: transcript,
          fiber_characteristics: tags,
        },
      });
      toast.success(editingId ? "Uppdaterad." : "Sparad och indexerad.");
      reset();
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara.");
    } finally {
      setBusy("idle");
    }
  };

  const handleReTranscribe = async () => {
    if (!audioPath) return;
    setBusy("transcribing");
    try {
      const { transcript: tx } = await transcribe({ data: { audio_path: audioPath } });
      setTranscript(tx);
      toast.success("Ny transkribering klar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transkribering misslyckades.");
    } finally {
      setBusy("idle");
    }
  };

  const editExisting = async (r: Recording) => {
    setEditingId(r.id);
    setAudioPath(r.audio_path);
    setAudioPreviewUrl(r.audio_url);
    setKlassareNamn(r.klassare_namn ?? "");
    setInspelningDatum(r.inspelning_datum ?? "");
    setWoolClass(r.wool_class ?? "");
    setBreed(r.breed ?? "");
    setTranscript(r.transcript_full ?? "");
    // tags aren't on recording level, only per chunk — leave empty when editing
    setTags([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (r: Recording) => {
    if (!confirm("Radera denna inspelning och dess indexerade observationer?")) return;
    setBusy("deleting");
    try {
      await del({ data: { id: r.id, audio_path: r.audio_path } });
      toast.success("Raderad.");
      if (editingId === r.id) reset();
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte radera.");
    } finally {
      setBusy("idle");
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Expertkunskap" />
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
          <Shield className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Endast administratörer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Expertkunskap" />

      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-primary">
            {editingId ? "Redigera inspelning" : "Ny klassarinspelning"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Ladda upp ljud → auto-transkribering (svenska) → korrigera ord → tagga → spara.
            Texten chunkas och indexeras med embeddings för semantisk sökning.
          </p>
        </div>

        {/* Upload / re-transcribe */}
        <div>
          <Label className="block mb-2">Ljudfil (mp3 / wav / m4a)</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 px-3 h-10 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent">
              <Upload className="w-4 h-4" />
              {audioPath ? "Byt fil" : "Välj fil"}
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/mp4,audio/webm,audio/ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {audioPath && (
              <Button variant="outline" size="sm" onClick={handleReTranscribe} disabled={busy !== "idle"}>
                <RefreshCw className="w-4 h-4 mr-1.5" /> Transkribera om
              </Button>
            )}
            {busy === "uploading" && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Laddar upp…</span>}
            {busy === "transcribing" && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Transkriberar med Whisper…</span>}
          </div>
          {audioPreviewUrl && (
            <audio controls src={audioPreviewUrl} className="mt-3 w-full" />
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Klassarens namn</Label>
            <Input value={klassareNamn} onChange={(e) => setKlassareNamn(e.target.value)} placeholder="t.ex. Anna Lindqvist" />
          </div>
          <div>
            <Label>Inspelningsdatum</Label>
            <Input type="date" value={inspelningDatum} onChange={(e) => setInspelningDatum(e.target.value)} />
          </div>
          <div>
            <Label>Ullklass</Label>
            <Select value={woolClass} onValueChange={setWoolClass}>
              <SelectTrigger><SelectValue placeholder="Välj klass" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {WOOL_CLASSES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ras / lantras</Label>
            <Select value={breed} onValueChange={setBreed}>
              <SelectTrigger><SelectValue placeholder="Välj ras" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {BREEDS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="block mb-2">Fiberegenskaper (tagga vad inspelningen handlar om)</Label>
          <div className="flex flex-wrap gap-2">
            {FIBER_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="block mb-2">Transkription (svenska) — korrigera ull-specifika ord</Label>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={10}
            placeholder="märghår, bottenull, täckhår, stickighet, glans, lockstruktur, krusning, fetthalt …"
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Texten chunkas på mening/topic vid sparning och indexeras i pgvector.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={busy !== "idle" || !audioPath || !transcript.trim()}>
            <Save className="w-4 h-4 mr-1.5" />
            {busy === "saving" ? "Sparar…" : (editingId ? "Spara ändringar" : "Spara & indexera")}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={reset} disabled={busy !== "idle"}>
              Avbryt redigering
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-primary inline-flex items-center gap-2">
            <Headphones className="w-5 h-5" /> Inspelningar
          </h2>
          <Button variant="ghost" size="sm" onClick={loadList} disabled={loadingList}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingList ? "animate-spin" : ""}`} /> Uppdatera
          </Button>
        </div>

        {recordings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Inga klassarinspelningar ännu. Ladda upp den första ovan.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recordings.map((r) => (
              <li key={r.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {r.klassare_namn ?? "Okänd klassare"}
                      {r.inspelning_datum && <span className="text-muted-foreground font-normal"> · {r.inspelning_datum}</span>}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {r.wool_class && <Badge variant="outline" className="text-[10px]">{r.wool_class}</Badge>}
                      {r.breed && <Badge variant="outline" className="text-[10px]">{r.breed}</Badge>}
                      <Badge variant="outline" className="text-[10px]">{r.chunk_count} chunks</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => editExisting(r)}>Redigera</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r)}
                      disabled={busy === "deleting"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {r.audio_url && <audio controls src={r.audio_url} className="w-full h-8" />}
                {r.transcript_full && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{r.transcript_full}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
