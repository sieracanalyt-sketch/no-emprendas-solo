// Edge Function: livekit-token
// Mints a short-lived LiveKit join token for the authenticated NES user.
//
// Two modes:
//   • MERGE cockpit (no body.room): unique `merge-*` room per connection. LiveKit
//     only creates an agent job when a room is first joined; reusing a fixed room
//     name meant the agent never re-dispatched after its first crash/restart.
//     Do not revert to a fixed room.
//   • Real calls (body.room = "call-..."): both users join the SAME room. The
//     identity is the FULL user id so the client can map participants to users.
//     Only rooms with the `call-` prefix are accepted from the client.
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
// NOTE: the deployed version (v4) carries inline fallbacks for these because the
// Vault secrets weren't set yet. If you redeploy from this file, set the secrets
// first or the function will return 500.
import { AccessToken } from "npm:livekit-server-sdk@2"
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const LK_URL = Deno.env.get("LIVEKIT_URL")
const LK_KEY = Deno.env.get("LIVEKIT_API_KEY")
const LK_SECRET = Deno.env.get("LIVEKIT_API_SECRET")

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    if (!LK_URL || !LK_KEY || !LK_SECRET) {
      return json({ error: "LiveKit not configured" }, 500)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: "no autenticado" }, 401)

    let body: { room?: string } = {}
    try { body = await req.json() } catch { /* sin body → modo MERGE */ }

    if (body.room) {
      // ── Llamada real entre usuarios ──
      if (!/^call-[a-z0-9-]{6,80}$/i.test(body.room)) {
        return json({ error: "sala no permitida" }, 400)
      }
      const { data: me } = await supa.from("users").select("nombre").eq("id", user.id).single()
      const at = new AccessToken(LK_KEY, LK_SECRET, {
        identity: user.id,
        name: me?.nombre ?? "Usuario",
        ttl: "2h",
      })
      at.addGrant({ room: body.room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
      return json({ token: await at.toJwt(), url: LK_URL, room: body.room })
    }

    // ── MERGE: sala única por conexión → job nuevo → el agente entra siempre ──
    const room = `merge-${user.id.slice(0, 8)}-${Date.now().toString(36)}`
    const at = new AccessToken(LK_KEY, LK_SECRET, { identity: `nes-${user.id.slice(0, 8)}`, ttl: "1h" })
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
    const token = await at.toJwt()

    return json({ token, url: LK_URL, room })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}
