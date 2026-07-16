// Edge Function: nes-daily — cron diario de retención (pg_cron → 08:00 UTC).
//
// 1) PRESTIGIO por aportar (0–100) para cada usuario:
//      · Perfil completo (40) — nombre, bio≥250, proyecto, buscando
//      · Velocidad de respuesta (35) — media de horas al contestar (30 días)
//      · Constancia (25) — racha + actividad reciente
//    Guarda users.prestige + users.prestige_detail.
//
// 2) RE-ENGAGEMENT a los 7 días de inactividad: email vía Resend con un match
//    sugerido concreto. Anti-spam: máximo 1 email cada 14 días por usuario
//    (re_engagement_log), así que invocarla de más no duplica envíos.
//
// Secrets: RESEND_API_KEY (obligatorio para emails), RESEND_FROM (opcional,
// por defecto onboarding@resend.dev — solo sirve para pruebas al propio buzón).
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type UserRow = {
  id: string
  nombre: string | null
  email: string | null
  biografia: string | null
  proyecto: string | null
  buscando: string[] | null
  last_login: string | null
  streak_days: number | null
}

type Msg = { chat_id: string; from_uid: string; created_at: string }

const DAY = 86_400_000

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / DAY
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: usersRaw, error: uErr } = await supa
      .from("users")
      .select("id, nombre, email, biografia, proyecto, buscando, last_login, streak_days")
    if (uErr) throw uErr
    const users = (usersRaw ?? []) as UserRow[]

    // ── Velocidad de respuesta: mensajes de los últimos 30 días ──
    const since = new Date(Date.now() - 30 * DAY).toISOString()
    const { data: msgsRaw } = await supa
      .from("messages")
      .select("chat_id, from_uid, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
    const msgs = (msgsRaw ?? []) as Msg[]

    const byChat = new Map<string, Msg[]>()
    for (const m of msgs) {
      const arr = byChat.get(m.chat_id) ?? []
      arr.push(m)
      byChat.set(m.chat_id, arr)
    }

    // delays[uid] = horas que tardó en responder (una muestra por respuesta)
    const delays: Record<string, number[]> = {}
    for (const arr of byChat.values()) {
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1]
        const cur = arr[i]
        if (prev.from_uid !== cur.from_uid) {
          const h = (new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime()) / 3_600_000
          ;(delays[cur.from_uid] ??= []).push(h)
        }
      }
      // Ghosting: último mensaje sin responder hace más de 72 h → muestra de castigo
      const last = arr[arr.length - 1]
      const ageH = (Date.now() - new Date(last.created_at).getTime()) / 3_600_000
      if (ageH > 72) {
        // El receptor es "el otro" participante del chat: id1_id2
        const [a, b] = last.chat_id.split("_")
        const receiver = last.from_uid === a ? b : a
        if (receiver) (delays[receiver] ??= []).push(96)
      }
    }

    // ── Calcular y guardar prestigio ──
    let updated = 0
    for (const u of users) {
      const perfil =
        (u.nombre?.trim() ? 5 : 0) +
        ((u.biografia?.trim().length ?? 0) >= 250 ? 15 : 0) +
        (u.proyecto?.trim() ? 10 : 0) +
        ((u.buscando?.length ?? 0) >= 1 ? 10 : 0)

      const ds = delays[u.id]
      let respuesta: number
      if (!ds || ds.length === 0) {
        respuesta = 15 // neutral: sin conversaciones recientes no se premia ni castiga
      } else {
        const avg = ds.reduce((s, x) => s + x, 0) / ds.length
        respuesta = avg < 6 ? 35 : avg < 24 ? 25 : avg < 48 ? 15 : avg < 72 ? 8 : 2
      }

      const streak = u.streak_days ?? 0
      const activeDays = daysSince(u.last_login)
      const constancia = streak >= 7 ? 25 : streak >= 3 ? 18 : streak >= 1 ? 12 : activeDays <= 7 ? 8 : 0

      const prestige = Math.max(0, Math.min(100, perfil + respuesta + constancia))
      const { error } = await supa
        .from("users")
        .update({
          prestige,
          prestige_detail: { perfil, respuesta, constancia, computed_at: new Date().toISOString() },
        })
        .eq("id", u.id)
      if (!error) updated++
    }

    // ── Re-engagement: inactivos 7–30 días, sin email en los últimos 14 ──
    const resendKey = Deno.env.get("RESEND_API_KEY")
    const from = Deno.env.get("RESEND_FROM") ?? "NES <onboarding@resend.dev>"
    const appUrl = "https://no-emprendas-solo.vercel.app"

    const { data: logRows } = await supa
      .from("re_engagement_log")
      .select("user_id")
      .gte("sent_at", new Date(Date.now() - 14 * DAY).toISOString())
    const recentlyMailed = new Set((logRows ?? []).map((r: { user_id: string }) => r.user_id))

    const actives = users.filter((u) => daysSince(u.last_login) <= 7)
    const dormant = users.filter((u) => {
      const d = daysSince(u.last_login)
      return d >= 7 && d <= 30 && !!u.email && !recentlyMailed.has(u.id)
    })

    let sent = 0
    const errors: string[] = []
    for (const u of dormant) {
      // Match sugerido: activo cuyo perfil encaja con lo que busca (o el más reciente)
      const wants = (u.buscando ?? []).join(" ").toLowerCase()
      const pick =
        actives.find((a) =>
          a.id !== u.id && wants &&
          `${a.proyecto ?? ""} ${a.biografia ?? ""}`.toLowerCase().split(/\W+/).some((w) => w.length >= 4 && wants.includes(w)),
        ) ?? actives.find((a) => a.id !== u.id)
      if (!pick) break // sin usuarios activos no hay nada que sugerir

      if (resendKey) {
        const nombre = u.nombre?.split(" ")[0] || "hola"
        const sugName = pick.nombre || "Un fundador activo"
        const sugProj = pick.proyecto ? ` · ${pick.proyecto.slice(0, 90)}` : ""
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [u.email],
            subject: `${u.nombre?.split(" ")[0] ?? "Fundador"}, ${sugName} podría ser tu próximo socio en NES`,
            html: `
              <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px;color:#1a1a1a">
                <p style="font-size:15px">Hola ${nombre} 👋</p>
                <p style="font-size:15px;line-height:1.6">Hace una semana que no pasas por <strong>No Emprendas Solo</strong> y mientras tanto la red sigue moviéndose. Este perfil encaja con lo que buscas:</p>
                <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px 18px;margin:18px 0">
                  <p style="margin:0;font-size:16px;font-weight:600">${sugName}${sugProj}</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#555">${(pick.biografia ?? "").slice(0, 140)}…</p>
                </div>
                <a href="${appUrl}/explorar" style="display:inline-block;background:#5e6ad2;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px">Ver mi match →</a>
                <p style="font-size:12px;color:#888;margin-top:22px;line-height:1.5">Recuerda: tras 7 días sin actividad tu visibilidad en el feed baja a la mitad (filtro anti-ghosting). Entrar hoy la recupera al instante.</p>
              </div>`,
          }),
        })
        if (!res.ok) {
          errors.push(`resend ${res.status} para ${u.id}`)
          continue
        }
        sent++
      }

      await supa.from("re_engagement_log").insert({
        user_id: u.id,
        reason: resendKey ? "email-7d-inactivo" : "detectado-sin-resend-key",
        suggested_user_id: pick.id,
      })
    }

    return json({
      ok: true,
      prestige_updated: updated,
      dormant_found: dormant.length,
      emails_sent: sent,
      resend_configured: !!resendKey,
      errors,
    })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}
