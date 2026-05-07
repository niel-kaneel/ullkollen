// Admin-only privileged actions: set password, send password reset,
// update email, export single user, export all data.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdminRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdminRow) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { action, user_id, email, password, redirect_to } = body ?? {};

    if (action === "set_password") {
      if (!user_id || !password || String(password).length < 8)
        return json({ error: "password must be >= 8 chars" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "send_reset") {
      if (!email) return json({ error: "email required" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirect_to || undefined,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "update_email") {
      if (!user_id || !email) return json({ error: "email required" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { email });
      if (error) throw error;
      await admin.from("profiles").update({ email }).eq("id", user_id);
      return json({ ok: true });
    }

    if (action === "export_user") {
      if (!user_id) return json({ error: "user_id required" }, 400);
      const [profile, sheep, classifications, support, roles] = await Promise.all([
        admin.from("profiles").select("*").eq("id", user_id).maybeSingle(),
        admin.from("sheep").select("*").eq("owner_id", user_id),
        admin.from("classifications").select("*").eq("user_id", user_id),
        admin.from("support_messages").select("*").eq("user_id", user_id),
        admin.from("user_roles").select("role").eq("user_id", user_id),
      ]);
      const { data: authUser } = await admin.auth.admin.getUserById(user_id);
      return json({
        exported_at: new Date().toISOString(),
        auth: authUser?.user
          ? {
              id: authUser.user.id,
              email: authUser.user.email,
              created_at: authUser.user.created_at,
              last_sign_in_at: authUser.user.last_sign_in_at,
            }
          : null,
        profile: profile.data,
        roles: roles.data,
        sheep: sheep.data ?? [],
        classifications: classifications.data ?? [],
        support_messages: support.data ?? [],
      });
    }

    if (action === "export_all") {
      const tables = ["profiles", "sheep", "classifications", "support_messages", "user_roles"];
      const out: Record<string, any> = {};
      for (const t of tables) {
        const { data } = await admin.from(t).select("*");
        out[t] = data ?? [];
      }
      return json({ exported_at: new Date().toISOString(), ...out });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
