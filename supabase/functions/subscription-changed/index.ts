// ──────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION CHANGED — stub del webhook de suscripciones.
//
// ⚠️ NO está cableado a Stripe. Es el punto de entrada futuro para Stripe
// Connect (partners): cuando llegue la Fase 2, Stripe llamará aquí con la
// firma verificada. Hoy sirve para QA y para el panel /admin.
//
// POST { user_id, new_tier: "free"|"premium", partner_id?, event_type: "upgrade"|"downgrade"|"cancel" }
// Auth: header `x-webhook-secret` == secret WEBHOOK_SECRET, O BIEN un JWT de
// admin en Authorization (para que /admin pueda cambiar tiers sin exponer el
// secret en el navegador).
//
// Efecto: upsert en subscriptions + update users.tier. El realtime de ambas
// tablas hace que el usuario afectado vea el cambio al instante.
//
// Secrets: WEBHOOK_SECRET (definir en Dashboard → Edge Functions → Secrets).
// ──────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Payload = {
  user_id?: string
  new_tier?: "free" | "premium"
  partner_id?: string | null
  event_type?: "upgrade" | "downgrade" | "cancel"
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

  // Auth: secret de webhook O JWT de admin
  const secret = Deno.env.get("WEBHOOK_SECRET")
  const givenSecret = req.headers.get("x-webhook-secret")
  let authorized = Boolean(secret && givenSecret && givenSecret === secret)

  if (!authorized) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    if (jwt) {
      const { data: userData } = await admin.auth.getUser(jwt)
      if (userData?.user) {
        const { data: row } = await admin
          .from("users")
          .select("is_admin")
          .eq("id", userData.user.id)
          .single()
        authorized = row?.is_admin === true
      }
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401)

  // Payload
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "bad_request" }, 400)
  }
  const { user_id, new_tier, partner_id, event_type } = payload
  if (!user_id || !new_tier || !event_type) return json({ error: "bad_request" }, 400)
  if (!["free", "premium"].includes(new_tier)) return json({ error: "bad_request" }, 400)
  if (!["upgrade", "downgrade", "cancel"].includes(event_type))
    return json({ error: "bad_request" }, 400)

  const now = new Date().toISOString()
  const status = event_type === "cancel" ? "canceled" : "active"

  // Upsert de la subscription más reciente del usuario
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1)

  const subRow = {
    user_id,
    tier: new_tier,
    status,
    partner_id: partner_id ?? null,
    updated_at: now,
  }
  const subResult = existing?.[0]
    ? await admin.from("subscriptions").update(subRow).eq("id", existing[0].id)
    : await admin.from("subscriptions").insert(subRow)
  if (subResult.error) return json({ error: "subscription_failed", detail: subResult.error.message }, 500)

  // Tier efectivo en users (cancel ⇒ free)
  const effectiveTier = event_type === "cancel" ? "free" : new_tier
  const { error: userErr } = await admin
    .from("users")
    .update({ tier: effectiveTier })
    .eq("id", user_id)
  if (userErr) return json({ error: "user_update_failed", detail: userErr.message }, 500)

  return json({ ok: true, user_id, tier: effectiveTier, status })
})
