// Edge Function: admin-generate-invite
// Solo users.is_admin=true puede generar códigos de invitación de la cohorte
// (POST { note?: string }) o listarlos (GET). El código se genera aquí, nunca
// lo elige el cliente, para que no se puedan adivinar por fuerza bruta.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sin 0/O/1/I para evitar confusiones
  let out = ""
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length]
    if (i === 3) out += "-"
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!jwt) return json({ error: "unauthorized" }, 401)
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401)

  const { data: row } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single()
  if (row?.is_admin !== true) return json({ error: "forbidden" }, 403)

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("invite_codes")
      .select("code, note, created_at, used_by, used_at, users:used_by(nombre, email)")
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) return json({ error: "server_error" }, 500)
    return json({ ok: true, codes: data })
  }

  if (req.method !== "POST") return json({ error: "bad_request" }, 405)

  let payload: { note?: string } = {}
  try { payload = await req.json() } catch { /* body opcional */ }

  let code = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    code = genCode()
    const { error: insertError } = await admin
      .from("invite_codes")
      .insert({ code, note: payload.note?.trim() || null, created_by: userData.user.id })
    if (!insertError) return json({ ok: true, code })
    // Colisión (muy improbable): reintenta con otro código
  }
  return json({ error: "server_error" }, 500)
})
