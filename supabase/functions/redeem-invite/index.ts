// Edge Function: redeem-invite
// El usuario autenticado canjea un código de invitación de la cohorte.
// Si el código existe y no ha sido usado, lo marca como usado (atómico, vía
// WHERE used_by is null) y aprueba a users.cohort_approved=true. Ese update
// solo puede hacerlo el service_role (ver trigger protect_cohort_approved).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "bad_request" }, 405)

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!jwt) return json({ error: "unauthorized" }, 401)
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401)

  let payload: { code?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: "bad_request" }, 400)
  }
  const code = (payload.code ?? "").trim().toUpperCase()
  if (!code) return json({ error: "missing_code" }, 400)

  const { data: claimed, error: claimError } = await admin
    .from("invite_codes")
    .update({ used_by: userData.user.id, used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_by", null)
    .select("code")
    .maybeSingle()

  if (claimError) return json({ error: "server_error" }, 500)
  if (!claimed) return json({ ok: false, error: "invalid_or_used" }, 200)

  const { error: approveError } = await admin
    .from("users")
    .update({ cohort_approved: true })
    .eq("id", userData.user.id)

  if (approveError) return json({ error: "server_error" }, 500)
  return json({ ok: true })
})
