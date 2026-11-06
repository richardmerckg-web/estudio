const configuredOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": configuredOrigin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

export function handleOptions(request: Request) {
  if (request.method !== "OPTIONS") {
    return null;
  }

  return new Response("ok", { headers: corsHeaders() });
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character,
  );
}
