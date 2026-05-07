import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy, LogOut, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t, lang, setLang } = useTranslation();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", farm_name: "", phone: "", address: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        farm_name: profile.farm_name ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
      });
      if (profile.home_lat && profile.home_lng) setCoords({ lat: profile.home_lat, lng: profile.home_lng });
    }
  }, [profile]);

  const updateLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        toast.success(t("locationSaved"));
      },
      () => toast.error(t("error")),
    );
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      ...form,
      home_lat: coords?.lat ?? null,
      home_lng: coords?.lng ?? null,
      language: lang,
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(t("saved")); refreshProfile(); }
  };

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-bold text-primary">{t("profile")}</h2>

      <Field label={t("fullName")} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
      <Field label={t("farmName")} value={form.farm_name} onChange={(v) => setForm({ ...form, farm_name: v })} />
      <Field label={t("phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
      <Field label={t("address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

      <Button variant="outline" onClick={updateLocation} className="w-full h-14 rounded-xl border-2 text-base">
        <MapPin className="w-5 h-5 mr-2" />
        {coords ? `📍 ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : t("updateLocation")}
      </Button>

      <div>
        <Label className="text-base">{t("language")}</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant={lang === "sv" ? "default" : "outline"} onClick={() => setLang("sv")} className="h-12 rounded-xl">Svenska</Button>
          <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")} className="h-12 rounded-xl">English</Button>
        </div>
      </div>

      <Button onClick={save} disabled={busy} size="lg" className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-base">
        {t("save")}
      </Button>

      <Button asChild variant="outline" className="w-full h-14 rounded-2xl text-base">
        <Link to="/app/support">
          <LifeBuoy className="w-5 h-5 mr-2" />
          {lang === "sv" ? "Kontakta support" : "Contact support"}
        </Link>
      </Button>

      <button onClick={doSignOut} className="w-full text-destructive text-sm py-4 flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> {t("signOut")}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-base">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-14 text-base mt-2 rounded-xl" />
    </div>
  );
}
