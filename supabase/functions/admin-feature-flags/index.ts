// ──────────────────────────────────────────────────────────────────────────────
// ADMIN FEATURE FLAGS — toggle server-side de features premium sin redeploy.
//
// POST { feature: string, active?: boolean, min_tier?: "free" | "premium" }
// Auth: Authorization Bearer <jwt del usuario>. Solo usuarios con
// users.is_admin=true pueden escribir. La escritura usa el service role
// (feature_flags no tiene policies de escritura para clientes).
//
// El realtime de feature_flags propaga el cambio a todas las pestañas abiertas.
//
// Secrets: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (inyectados por Supabase).
// ──────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Payload = {
  feature?: string
  active?: boolean
  min_tier?: "free" | "premium"
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // 1. Identificar al caller por su JWT
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!jwt) return json({ error: "unauthorized" }, 401)
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401)

  // 2. Verificar is_admin
  const { data: row } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single()
  if (row?.is_admin !== true) return json({ error: "forbidden" }, 403)

  // 3. Validar payload
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "bad_request" }, 400)
  }
  const { feature, active, min_tier } = payload
  if (!feature || typeof feature !== "string") return json({ error: "bad_request" }, 400)
  if (active === undefined && min_tier === undefined) return json({ error: "bad_request" }, 400)
  if (min_tier !== undefined && !["free", "premium"].includes(min_tier))
    return json({ error: "bad_request" }, 400)

  // 4. Update
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (active !== undefined) patch.active = active === true
  if (min_tier !== undefined) patch.min_tier = min_tier

  const { data, error } = await admin
    .from("feature_flags")
    .update(patch)
    .eq("feature", feature)
    .select("feature, min_tier, active")
    .single()

  if (error) return json({ error: "update_failed", detail: error.message }, 500)
  return json({ ok: true, flag: data })
})
