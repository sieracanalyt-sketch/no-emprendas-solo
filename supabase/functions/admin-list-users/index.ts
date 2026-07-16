// Edge Function: admin-list-users
// Lista los usuarios CON su email para el panel /admin. Existe porque la columna
// users.email ya no es legible por ningún cliente (ni anon ni authenticated): se
// revocó a nivel de columna tras detectar que cualquiera podía descargar los
// correos de la comunidad con la anon key. El email solo sale de aquí, y solo
// para users.is_admin = true, usando el service role.
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

  const { data, error } = await admin
    .from("users")
    .select("id, nombre, email, avatar, tier, is_admin")
    .order("nombre")

  if (error) return json({ error: "server_error" }, 500)
  return json({ ok: true, users: data })
})
