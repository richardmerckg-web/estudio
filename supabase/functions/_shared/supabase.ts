import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

function readKey(name: "publishable" | "secret") {
  const keysVariable = name === "publishable" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS";
  const keys = Deno.env.get(keysVariable);

  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // Fall back to the legacy environment variables below.
    }
  }

  return name === "publishable"
    ? Deno.env.get("SUPABASE_ANON_KEY") || ""
    : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

export function createAdminClient() {
  const secretKey = readKey("secret");
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Edge Function secrets are not configured.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createUserClient(accessToken: string) {
  const publishableKey = readKey("publishable");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase publishable key is not configured.");
  }

  return createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(request: Request, admin: SupabaseClient) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    return { error: "Authentication required.", status: 401 as const };
  }

  const userClient = createUserClient(token);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: "Authentication required.", status: 401 as const };
  }

  const { data: adminUser, error: adminError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    throw adminError;
  }

  if (!adminUser) {
    return { error: "Admin access required.", status: 403 as const };
  }

  return { user: userData.user };
}

export function parseDateOnly(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function addDays(value: string, amount: number) {
  const date = parseDateOnly(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function generateDates(checkIn: string, checkOut: string) {
  const dates: string[] = [];
  for (let date = checkIn; date && date < checkOut; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function localTodayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function rateForDate(value: string) {
  const date = parseDateOnly(value);
  if (!date) return 0;
  const day = date.getUTCDay();
  return day === 0 || day === 6 ? 2500 : 2000;
}

export function calculateTotal(checkIn: string, checkOut: string) {
  return generateDates(checkIn, checkOut).reduce((total, date) => total + rateForDate(date), 0);
}
