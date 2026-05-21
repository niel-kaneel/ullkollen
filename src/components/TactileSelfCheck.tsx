import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, Hand, Send, ChevronDown, CheckCircle2, AlertTriangle, Info, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { compareTactile, transcribeUserAudio } from "@/lib/expert.functions";

type Source = {
  id: string;
  klassare_namn: string | null;
  inspelning_datum: string | null;
  audio_url: string | null;
};

type ComparisonResult = {
  opening_line: string;
  matches: string[];
  differs: string[];
  not_mentioned: string[];
  possible_reclassification: { suggested_class: string | null; reason: string | null } | null;
};

type Result =
  | { empty: true; wool_class: string | null; sources: Source[]; result: null }
  | { empty: false; wool_class: string | null; sources: Source[]; result: ComparisonResult };

const HELPER_ITEMS: Array<{ title: string; body: string }> = [
  { title: "Stickighet", body: "Drag handen mot fibern. Stickigt = grova täckhår eller märghår." },
  { title: "Märghår", body: "Tjocka, vita, ihåliga strån som bryts lätt. Känns torra och raka." },
  { title: "Fetthalt (lanolin)", body: "Klibbar lätt mellan fingrarna. Vissa raser har mycket, andra nästan inget." },
  { title: "Krusning", body: "Räkna vågorna per centimeter — fin krusning = fin fiber." },
  { title: "Lockstruktur", body: "Tydliga lockar med spets och bas pekar mot pälsull (P-typ)." },
];

export function TactileSelfCheck({
  classificationId,
  woolClass,
  onCorrectionSuggested,
}: {
  classificationId: string;
  woolClass: string | null;
  onCorrectionSuggested: (suggested: string) => void;
}) {
  const compare = useServerFn(compareTactile);
  const transcribe = useServerFn(transcribeUserAudio);

  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [helperOpen, setHelperOpen] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          // base64 encode
          const bytes = new Uint8Array(buf);
          let bin = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const b64 = btoa(bin);
          const { transcript } = await transcribe({
            data: { audio_base64: b64, filename: `voice.${blob.type.includes("webm") ? "webm" : "m4a"}` },
          });
          setDescription((d) => (d ? d + " " : "") + transcript.trim());
        } catch (e) {
          toast.error("Vi kunde inte tolka inspelningen. Vill du skriva istället?");
          console.error(e);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      toast.error("Mikrofonåtkomst nekades.");
      console.error(e);
    }
  };

  const stopRecording = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  const submit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Make sure we have a session
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Du måste vara inloggad.");
        return;
      }
      const res = (await compare({
        data: { classification_id: classificationId, description: description.trim() },
      })) as Result;
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section header — same style as REKOMMENDATION */}
      <div className="bg-accent/90 text-accent-foreground rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">Känn på ullen</p>
        <p className="text-base font-bold mt-1.5 leading-snug">
          Bilden visar mycket, men händerna känner mer. Beskriv hur ullen känns — så jämför vi med en erfaren klassare.
        </p>
      </div>

      {/* Input area */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Hand className="w-3.5 h-3.5" /> Lägg handen i ullen. Vad känner du först?
        </p>

        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="T.ex. mjuk, lite fet, fjädrande lockar, inga märghår…"
          disabled={submitting || transcribing}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {!recording ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startRecording}
              disabled={submitting || transcribing}
              className="rounded-xl"
            >
              <Mic className="w-4 h-4 mr-1.5" />
              {transcribing ? "Transkriberar…" : "Spela in beskrivning"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="rounded-xl animate-pulse"
            >
              <Square className="w-4 h-4 mr-1.5" /> Stoppa inspelning
            </Button>
          )}
          {transcribing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

          <Button
            type="button"
            onClick={submit}
            disabled={submitting || transcribing || !description.trim()}
            size="sm"
            className="ml-auto rounded-xl"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {submitting ? "Jämför…" : "Jämför med klassare"}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setHelperOpen((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground pt-1"
        >
          <span>Vad ska jag känna efter?</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${helperOpen ? "rotate-180" : ""}`} />
        </button>
        {helperOpen && (
          <ul className="text-xs space-y-1.5 text-muted-foreground border-t border-border pt-3">
            {HELPER_ITEMS.map((h) => (
              <li key={h.title}>
                <span className="font-semibold text-foreground">{h.title}:</span> {h.body}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-muted-foreground italic pt-1">
          Din beskrivning sparas anonymt för att förbättra systemet över tid.
        </p>
      </div>

      {/* Result */}
      {result && result.empty && (
        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-sm">
          Vi har ännu inga klassarinspelningar för {woolClass ?? "denna klass"}. Din beskrivning sparas och hjälper oss bygga upp kunskapen.
        </div>
      )}

      {result && !result.empty && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Så skulle en klassare känna
              </p>
              <p className="text-base mt-2 leading-relaxed">{result.result.opening_line}</p>
            </div>

            {result.result.matches.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Det här stämmer med din beskrivning
                </p>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {result.result.matches.map((m, i) => (<li key={i}>{m}</li>))}
                </ul>
              </div>
            )}

            {result.result.differs.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4" /> Det här skiljer sig
                </p>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {result.result.differs.map((m, i) => (<li key={i}>{m}</li>))}
                </ul>
              </div>
            )}

            {result.result.not_mentioned.length > 0 && (
              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
                  <Info className="w-4 h-4" /> Det här nämnde inte klassaren
                </p>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {result.result.not_mentioned.map((m, i) => (<li key={i}>{m}</li>))}
                </ul>
              </div>
            )}
          </div>

          {/* Possible reclassification */}
          {result.result.possible_reclassification?.suggested_class && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-destructive">
                Möjlig omklassning
              </p>
              <p className="text-sm mt-2">
                Din känselbeskrivning tyder på att klassen kan behöva ses över
                {result.result.possible_reclassification.suggested_class && (
                  <> — möjligen <strong>{result.result.possible_reclassification.suggested_class}</strong></>
                )}
                . Vill du föreslå en korrigering?
              </p>
              {result.result.possible_reclassification.reason && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">
                  {result.result.possible_reclassification.reason}
                </p>
              )}
              <Button
                size="sm"
                className="mt-3 rounded-xl"
                onClick={() =>
                  onCorrectionSuggested(result.result.possible_reclassification!.suggested_class!)
                }
              >
                Föreslå ny klass →
              </Button>
            </div>
          )}

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="bg-card/50 border border-border rounded-2xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Källor
              </p>
              {result.sources.map((s) => (
                <div key={s.id} className="space-y-1.5">
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" />
                    Baserat på inspelning med <strong className="text-foreground">{s.klassare_namn ?? "okänd klassare"}</strong>
                    {s.inspelning_datum && <>, {s.inspelning_datum}</>}
                  </p>
                  {s.audio_url && <audio controls src={s.audio_url} className="w-full h-8" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
