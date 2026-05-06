import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hebsejawtxdmumccvojn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Cw5uHTuvLdPqji7KhJkOpg_N-RzN62x";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
