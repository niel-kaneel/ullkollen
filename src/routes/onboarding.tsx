import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { SheepLogo } from "@/components/SheepLogo";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: Onboarding,
});

function Onboarding() {
  const { t, lang } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    farm_name: "",
    phone: "",
    address: "",
    role: "farmer" as "farmer" | "shearer",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Try to capture location early
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
      );
    }
  }, []);

  const fetchLocation = () =>
    new Promise<void>((resolve) => {
      if (!navigator.geolocation) return resolve();
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
          toast.success(t("locationSaved"));
          resolve();
        },
        () => resolve(),
      );
    });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        ...form,
        home_lat: coords?.lat ?? null,
        home_lng: coords?.lng ?? null,
        language: lang,
      });
      if (error) throw error;
      await refreshProfile();
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 bg-background">
      <div className="flex flex-col items-center mb-6">
        <SheepLogo className="w-14 h-14 text-primary" />
        <h1 className="text-2xl font-bold text-primary mt-2">{t("appName")}</h1>
        <p className="text-sm text-muted-foreground">{lang === "sv" ? "Berätta om dig själv" : "Tell us about yourself"}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t("fullName")} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
        <Field label={t("farmName")} value={form.farm_name} onChange={(v) => setForm({ ...form, farm_name: v })} />
        <Field label={t("phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
        <Field label={t("address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

        <div>
          <Label className="text-base">{t("role")}</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "farmer" | "shearer" })}>
            <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="farmer">{t("farmer")}</SelectItem>
              <SelectItem value="shearer">{t("shearerRole")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" onClick={fetchLocation} className="w-full h-14 rounded-xl text-base border-2">
          <MapPin className="w-5 h-5 mr-2" />
          {coords ? `📍 ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : t("updateLocation")}
        </Button>

        <Button type="submit" disabled={busy} size="lg" className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90">
          {busy ? "..." : t("save")}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label className="text-base">{label}</Label>
      <Input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="h-14 text-base mt-2 rounded-xl" />
    </div>
  );
}
