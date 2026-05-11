import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Users, Trash2, ShieldOff, ShieldCheck, ChevronDown, ChevronUp,
  Mail, KeyRound, Download, Inbox, Send, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { breedLabel } from "@/lib/breeds";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  farm_name: string | null;
  phone: string | null;
  address: string | null;
  is_admin: boolean;
  classifications_count: number;
  sheep_count: number;
};

type SupportRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

type Detail = {
  profile: Record<string, unknown> | null;
  sheep: Array<Record<string, unknown>>;
  classifications: Array<Record<string, unknown>>;
  support_messages: Array<Record<string, unknown>>;
};

export const Route = createFileRoute("/app/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: Admin,
});

function Admin() {
  const { t } = useTranslation();
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [tab, setTab] = useState<"users" | "support">("users");
  const [support, setSupport] = useState<SupportRow[]>([]);

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data;
  };

  const loadUsers = async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) return toast.error(error.message);
    setUsers((data as AdminUser[]) ?? []);
  };

  const loadSupport = async () => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setSupport((data as SupportRow[]) ?? []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    loadSupport();
  }, [isAdmin]);

  const openUser = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id]) {
      const { data, error } = await supabase.rpc("admin_user_detail", { _user_id: id });
      if (error) return toast.error(error.message);
      setDetails((d) => ({ ...d, [id]: data as Detail }));
    }
  };

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.farm_name?.toLowerCase().includes(q),
    );
  }, [users, filter]);

  const totals = {
    users: users.length,
    classifications: users.reduce((s, u) => s + (u.classifications_count || 0), 0),
    sheep: users.reduce((s, u) => s + (u.sheep_count || 0), 0),
    openSupport: support.filter((s) => s.status === "open").length,
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">...</div>;
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("admin")} />
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
          <Shield className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Access denied</p>
        </div>
      </div>
    );
  }

  const toggleAdmin = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      if (u.is_admin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
        if (error) throw error;
      }
      toast.success(t("saved"));
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const { data: objs } = await supabase.storage.from("sheep-photos").list(u.id, { limit: 1000 });
      if (objs?.length) {
        const allPaths: string[] = [];
        for (const obj of objs) {
          const { data: inner } = await supabase.storage.from("sheep-photos").list(`${u.id}/${obj.name}`, { limit: 1000 });
          inner?.forEach((f) => allPaths.push(`${u.id}/${obj.name}/${f.name}`));
        }
        if (allPaths.length) await supabase.storage.from("sheep-photos").remove(allPaths);
      }
      await supabase.from("classifications").delete().eq("user_id", u.id);
      await supabase.from("sheep").delete().eq("owner_id", u.id);
      await supabase.from("user_roles").delete().eq("user_id", u.id);
      await supabase.from("profiles").delete().eq("id", u.id);
      toast.success(t("deleted"));
      setUsers((arr) => arr.filter((x) => x.id !== u.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusyId(null);
    }
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const data = await callAdmin({ action: "export_user", user_id: u.id });
      downloadJson(`ullkollen_${u.email || u.id}.json`, data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    } finally {
      setBusyId(null);
    }
  };

  const exportAll = async () => {
    try {
      const data = await callAdmin({ action: "export_all" });
      const obj = data as Record<string, unknown[]>;
      // Per-table CSV bundle
      for (const [name, rows] of Object.entries(obj)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const cols = Object.keys(rows[0] as Record<string, unknown>);
        const csv = [
          cols.join(","),
          ...rows.map((r) =>
            cols
              .map((c) => {
                const v = (r as Record<string, unknown>)[c];
                const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                return `"${s.replace(/"/g, '""')}"`;
              })
              .join(","),
          ),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ullkollen_${name}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      // Also a full JSON
      downloadJson(`ullkollen_full_export.json`, data);
      toast.success("Exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title={t("admin")} />

      <div className="bg-card border border-border rounded-2xl shadow-soft p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">{t("admin")}</h2>
              <p className="text-xs text-muted-foreground">Användare, support och dataexport</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={exportAll} className="rounded-lg shrink-0">
            <Download className="w-4 h-4 mr-1.5" /> Export all
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Stat label={t("totalUsers")} value={totals.users} />
          <Stat label={t("totalClassifications")} value={totals.classifications} />
          <Stat label={t("totalSheep")} value={totals.sheep} />
          <Stat label="Open support" value={totals.openSupport} />
        </div>
      </div>

      <div className="inline-flex w-full md:w-auto p-1 bg-secondary rounded-xl gap-1">
        <button
          onClick={() => setTab("users")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === "users" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Users className="w-4 h-4" /> {t("users")} ({users.length})
        </button>
        <button
          onClick={() => setTab("support")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === "support" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Inbox className="w-4 h-4" /> Support ({totals.openSupport})
        </button>
      </div>

      {tab === "users" && (
        <>
          <Input
            placeholder="Sök e-post / namn / gård"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-11 rounded-xl"
          />

          <div className="space-y-2.5">
            {filtered.map((u) => {
              const initials = (u.full_name || u.email || "?")
                .split(/[\s@.]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase())
                .join("");
              const isOpen = openId === u.id;
              return (
                <div
                  key={u.id}
                  className={`bg-card border rounded-2xl shadow-soft overflow-hidden transition-colors ${isOpen ? "border-primary/40" : "border-border"}`}
                >
                  <button
                    onClick={() => openUser(u.id)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-bold shrink-0">
                      {initials || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{u.full_name || u.email}</p>
                        {u.is_admin && (
                          <span className="text-[10px] uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold tracking-wider">
                            admin
                          </span>
                        )}
                      </div>
                      {u.full_name && (
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                        {u.farm_name && <span className="truncate max-w-[12rem]">🏡 {u.farm_name}</span>}
                        <span>{new Date(u.created_at).toLocaleDateString("sv-SE")}</span>
                        <span>· {u.classifications_count} {t("classifications").toLowerCase()}</span>
                        <span>· {u.sheep_count} {t("sheepCount").toLowerCase()}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border p-4 space-y-5 bg-secondary/30">
                      <UserActions
                        user={u}
                        busy={busyId === u.id}
                        callAdmin={callAdmin}
                        onChanged={loadUsers}
                        onExport={() => exportUser(u)}
                        onToggleAdmin={() => toggleAdmin(u)}
                        onDelete={() => deleteUser(u)}
                      />
                      <UserDetailPanel detail={details[u.id]} />
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">—</p>}
          </div>
        </>
      )}

      {tab === "support" && (
        <SupportInbox rows={support} onChanged={loadSupport} />
      )}
    </div>
  );
}

function UserActions({
  user, busy, callAdmin, onChanged, onExport, onToggleAdmin, onDelete,
}: {
  user: AdminUser;
  busy: boolean;
  callAdmin: (b: Record<string, unknown>) => Promise<unknown>;
  onChanged: () => void;
  onExport: () => void;
  onToggleAdmin: () => void;
  onDelete: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [pwd, setPwd] = useState("");
  const [fullName, setFullName] = useState(user.full_name ?? "");

  const saveName = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); onChanged(); }
  };

  const updateEmail = async () => {
    if (!email || email === user.email) return;
    try {
      await callAdmin({ action: "update_email", user_id: user.id, email });
      toast.success("Email updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    }
  };

  const sendReset = async () => {
    try {
      await callAdmin({ action: "send_reset", email: user.email, redirect_to: `${window.location.origin}/auth?mode=signin` });
      toast.success("Reset email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    }
  };

  const setPassword = async () => {
    if (pwd.length < 8) return toast.error("Min 8 chars");
    try {
      await callAdmin({ action: "set_password", user_id: user.id, password: pwd });
      toast.success("Password set");
      setPwd("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Konto</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Display name</Label>
            <div className="flex gap-2 min-w-0">
              <Input className="min-w-0 flex-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Button size="sm" onClick={saveName} className="shrink-0">Save</Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Login email</Label>
            <div className="flex gap-2 min-w-0">
              <Input className="min-w-0 flex-1" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              <Button size="sm" onClick={updateEmail} className="shrink-0" aria-label="Update email">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2 min-w-0">
            <Label className="text-xs">Set new password</Label>
            <div className="flex flex-wrap gap-2 min-w-0">
              <Input
                className="min-w-0 flex-1 basis-40"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                type="text"
                placeholder="min 8 chars"
              />
              <Button size="sm" onClick={setPassword} className="shrink-0">
                <KeyRound className="w-4 h-4 mr-1" /> Set
              </Button>
              <Button size="sm" variant="outline" onClick={sendReset} className="shrink-0">
                <Send className="w-4 h-4 mr-1" /> Reset email
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" disabled={busy} onClick={onToggleAdmin}>
          {user.is_admin ? <ShieldOff className="w-4 h-4 mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
          {user.is_admin ? "Remove admin" : "Make admin"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onExport}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy} className="text-destructive ml-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user data?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes profile, sheep, classifications and photos. The auth account itself remains.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function UserDetailPanel({ detail }: { detail: Detail | undefined }) {
  if (!detail) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const p = (detail.profile ?? {}) as Record<string, string | null>;
  const contactRows: Array<[string, string | null | undefined]> = [
    ["Förnamn", p.first_name],
    ["Efternamn", p.last_name],
    ["Telefon", p.phone],
    ["Adress", p.address],
    ["Gård", p.farm_name],
  ];
  const hasContact = contactRows.some(([, v]) => v);
  return (
    <div className="space-y-3">
      {hasContact && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Kontaktuppgifter
          </p>
          <div className="bg-card rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {contactRows.map(([label, val]) =>
              val ? (
                <div key={label} className="flex gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">{label}:</span>
                  <span className="font-medium truncate">{val}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          <FileText className="w-3 h-3 inline mr-1" /> Sheep ({detail.sheep.length})
        </p>
        <div className="space-y-1 max-h-48 overflow-auto">
          {detail.sheep.map((s) => {
            const r = s as Record<string, string | null>;
            return (
              <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1 flex justify-between gap-2">
                <span className="truncate">{r.ear_tag_id || r.name || (r.id as string).slice(0, 6)}</span>
                <span className="text-muted-foreground shrink-0">
                  {breedLabel(r.breed_code, "sv")} · {r.age_category}
                </span>
              </div>
            );
          })}
          {detail.sheep.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Classifications ({detail.classifications.length})
        </p>
        <div className="space-y-1 max-h-48 overflow-auto">
          {detail.classifications.slice(0, 50).map((c) => {
            const r = c as Record<string, string | null>;
            return (
              <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1 flex justify-between gap-2">
                <span className="truncate">{r.wool_class ?? "—"} · {r.wool_class_name_sv ?? ""}</span>
                <span className="text-muted-foreground shrink-0">{new Date(r.created_at as string).toLocaleDateString("sv-SE")}</span>
              </div>
            );
          })}
          {detail.classifications.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      </div>
      {detail.support_messages.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Support ({detail.support_messages.length})
          </p>
          <div className="space-y-1 max-h-32 overflow-auto">
            {detail.support_messages.map((m) => {
              const r = m as Record<string, string | null>;
              return (
                <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1">
                  <span className="font-semibold">{r.subject}</span> · {r.status}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SupportInbox({ rows, onChanged }: { rows: SupportRow[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const update = async (id: string, patch: Partial<SupportRow>) => {
    const { error } = await supabase
      .from("support_messages")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onChanged();
  };

  if (rows.length === 0)
    return <p className="text-center text-muted-foreground py-10 text-sm">No enquiries.</p>;

  return (
    <div className="space-y-2">
      {rows.map((m) => (
        <div key={m.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-2">
          <div className="flex justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate">{m.subject}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email || m.user_id}</p>
            </div>
            <span
              className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold shrink-0 ${
                m.status === "open" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {m.status}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
          {m.admin_notes && (
            <div className="text-sm bg-primary/10 rounded-lg p-2 whitespace-pre-wrap">
              <p className="text-xs font-semibold text-primary mb-1">Reply</p>
              {m.admin_notes}
            </div>
          )}
          {editing === m.id ? (
            <div className="space-y-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply / notes" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    update(m.id, { admin_notes: reply, status: "resolved" });
                    setEditing(null);
                    setReply("");
                  }}
                >
                  Save & resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setEditing(m.id); setReply(m.admin_notes ?? ""); }}>
                Reply
              </Button>
              {m.status === "open" ? (
                <Button size="sm" variant="outline" onClick={() => update(m.id, { status: "resolved" })}>
                  Mark resolved
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => update(m.id, { status: "open" })}>
                  Reopen
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground self-center ml-auto">
                {new Date(m.created_at).toLocaleString("sv-SE")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/60 border border-border/60 rounded-xl px-3 py-3 text-center">
      <p className="text-2xl md:text-3xl font-black text-primary leading-none">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider leading-tight mt-1.5 break-words">
        {label}
      </p>
    </div>
  );
}
