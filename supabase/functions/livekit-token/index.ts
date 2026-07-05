// Edge Function: livekit-token
// Mints a short-lived LiveKit join token for the authenticated NES user so the JARVIS
// cockpit (/jarvis) can join the room. The Python voice agent auto-dispatches into the
// same room. Mirrors the security model of the `ai-connect` function.
//
// Secrets required (Supabase → Project Settings → Edge Functions → Secrets):
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
//
// Deploy:  supabase functions deploy livekit-token
import { AccessToken } from "npm:livekit-server-sdk@2"
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const url = Deno.env.get("LIVEKIT_URL")
    const apiKey = Deno.env.get("LIVEKIT_API_KEY")
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")
    if (!url || !apiKey || !apiSecret) {
      return json({ error: "LiveKit secrets not configured" }, 500)
    }

    // Require an authenticated NES user (the token rides in the Authorization header).
    const authHeader = req.headers.get("Authorization") ?? ""
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: "no autenticado" }, 401)

    // One shared cockpit room; the agent auto-dispatches into it.
    const room = Deno.env.get("AIOS_ROOM") ?? "aios"
    const at = new AccessToken(apiKey, apiSecret, { identity: `nes-${user.id.slice(0, 8)}`, ttl: "1h" })
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
    const token = await at.toJwt()

    return json({ token, url, room })
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
