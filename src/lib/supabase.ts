// Re-export the auto-managed Lovable Cloud client
export { supabase } from "@/integrations/supabase/client";
export const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
