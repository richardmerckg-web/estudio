import { handleOptions, json } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const configuredSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = request.headers.get("x-cron-secret");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("expire_pending_bookings");
    if (error) throw error;
    return json({ expired: Number(data || 0) });
  } catch (error) {
    console.error("pending_expiry_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Could not expire pending bookings." }, 503);
  }
});
