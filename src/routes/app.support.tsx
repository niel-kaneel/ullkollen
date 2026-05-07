import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Message = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/app/support")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: Support,
});

function Support() {
  const { lang } = useTranslation();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Message[]>([]);

  const sv = lang === "sv";

  const load = () => {
    if (!user) return;
    supabase
      .from("support_messages")
      .select("id, subject, message, status, admin_notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Message[]) ?? []));
  };
  useEffect(load, [user]);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim() || !message.trim()) {
      toast.error(sv ? "Fyll i båda fälten" : "Fill both fields");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      email: user.email,
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(sv ? "Skickat" : "Sent");
    setSubject("");
    setMessage("");
    load();
  };

  return (
    <div className="space-y-5 pb-4">
      <BackButton />
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-primary">{sv ? "Support" : "Support"}</h2>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-3">
        <div className="space-y-1.5">
          <Label>{sv ? "Ämne" : "Subject"}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label>{sv ? "Meddelande" : "Message"}</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            rows={6}
          />
        </div>
        <Button onClick={submit} disabled={sending} className="w-full">
          {sending ? (sv ? "Skickar…" : "Sending…") : sv ? "Skicka" : "Send"}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{sv ? "Mina ärenden" : "My enquiries"}</h3>
          {items.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <div className="flex justify-between gap-2">
                <p className="font-semibold truncate">{m.subject}</p>
                <span className="text-xs text-muted-foreground shrink-0">{m.status}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{m.message}</p>
              {m.admin_notes && (
                <div className="mt-2 p-2 rounded-lg bg-primary/10 text-sm">
                  <p className="font-semibold text-primary text-xs mb-1">
                    {sv ? "Svar" : "Reply"}
                  </p>
                  <p className="whitespace-pre-wrap">{m.admin_notes}</p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                {new Date(m.created_at).toLocaleString(sv ? "sv-SE" : "en-US")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
