import { createClient } from "@supabase/supabase-js";

// Supabase publishable client values are safe to ship to the browser. Keep the
// environment variables as the primary source, with a deployment fallback so
// a static Pages build cannot lose admin access when build variables are scoped
// incorrectly in Cloudflare.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ibdexuderiqjotrdpntn.supabase.co";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_8XEW9-UZpryt8uD0gK-ghw_Gqgy8ofo";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase is not configured for this build.");
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}
