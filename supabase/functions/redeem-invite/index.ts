// Edge Function: redeem-invite
// El usuario autenticado canjea un código de invitación de la cohorte.
// Todo el trabajo (comprobar cupo, registrar el canje y aprobar la cohorte) lo
// hace el RPC redeem_invite_code en una única transacción con `for update`, para
// que 15 personas canjeando el mismo código a la vez no puedan pasarse del cupo.
// El RPC solo es ejecutable por service_role — de ahí el cliente admin.
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

  const { data: result, error: rpcError } = await admin.rpc("redeem_invite_code", {
    p_code: code,
    p_user: userData.user.id,
  })

  if (rpcError) return json({ error: "server_error" }, 500)
  if (result === "ok") return json({ ok: true })
  // 'invalid' = no existe · 'exhausted' = se agotaron los usos del código
  return json({ ok: false, error: result }, 200)
})
