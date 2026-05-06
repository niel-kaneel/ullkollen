import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Users, Trash2, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { BackButton } from "@/components/BackButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  full_name: string | null;
  farm_name: string | null;
  is_admin: boolean;
  classifications_count: number;
  sheep_count: number;
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

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) return toast.error(error.message);
    setUsers((data as AdminUser[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">...</div>;
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
          <Shield className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Access denied</p>
          <p className="text-sm text-muted-foreground">Du har inte admin-behörighet.</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.farm_name?.toLowerCase().includes(q)
    );
  });

  const totals = {
    users: users.length,
    classifications: users.reduce((s, u) => s + (u.classifications_count || 0), 0),
    sheep: users.reduce((s, u) => s + (u.sheep_count || 0), 0),
  };

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
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      // Delete user's storage objects
      const { data: objs } = await supabase.storage.from("sheep-photos").list(u.id, { limit: 1000 });
      if (objs?.length) {
        // List recursively per classification folder
        const allPaths: string[] = [];
        for (const obj of objs) {
          const { data: inner } = await supabase.storage.from("sheep-photos").list(`${u.id}/${obj.name}`, { limit: 1000 });
          inner?.forEach((f) => allPaths.push(`${u.id}/${obj.name}/${f.name}`));
        }
        if (allPaths.length) await supabase.storage.from("sheep-photos").remove(allPaths);
      }
      // Delete classifications & sheep (admin policies allow)
      await supabase.from("classifications").delete().eq("user_id", u.id);
      await supabase.from("sheep").delete().eq("owner_id", u.id);
      await supabase.from("user_roles").delete().eq("user_id", u.id);
      await supabase.from("profiles").delete().eq("id", u.id);
      toast.success(t("deleted"));
      setUsers((arr) => arr.filter((x) => x.id !== u.id));
      toast.message("Auth-kontot lever kvar — radera det manuellt i Cloud-dashboarden om så önskas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <BackButton />
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-primary">{t("admin")}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("totalUsers")} value={totals.users} />
        <Stat label={t("totalClassifications")} value={totals.classifications} />
        <Stat label={t("totalSheep")} value={totals.sheep} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t("users")}</h3>
        </div>
        <Input
          placeholder="Sök e-post / namn / gård"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{u.full_name || u.email}</p>
                  {u.is_admin && (
                    <span className="text-[10px] uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">
                      admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.farm_name && <p className="text-xs text-muted-foreground truncate">🏡 {u.farm_name}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t("joined")}: {new Date(u.created_at).toLocaleDateString("sv-SE")} · {u.classifications_count}{" "}
                  {t("classifications").toLowerCase()} · {u.sheep_count} {t("sheepCount").toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === u.id}
                onClick={() => toggleAdmin(u)}
                className="flex-1 rounded-lg"
              >
                {u.is_admin ? <ShieldOff className="w-4 h-4 mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                {u.is_admin ? t("removeAdmin") : t("makeAdmin")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={busyId === u.id} className="text-destructive hover:text-destructive rounded-lg">
                    <Trash2 className="w-4 h-4 mr-1" /> {t("delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteUser")}?</AlertDialogTitle>
                    <AlertDialogDescription>{t("confirmDeleteUser")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteUser(u)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">—</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 text-center shadow-soft">
      <p className="text-2xl font-black text-primary">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide leading-tight mt-1">{label}</p>
    </div>
  );
}
