import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"
import type { CalEvent } from "../lib/calendarUtils"

// ──────────────────────────────────────────────────────────────────────────────
// Próxima reunión del usuario (para el widget del sidebar de Mensajes, T1-20).
// ──────────────────────────────────────────────────────────────────────────────
export function useNextMeeting(user: User | null): CalEvent | null {
  const [next, setNext] = useState<CalEvent | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from("calendar_events")
        .select(
          "id, owner_id, title, description, start_at, end_at, color, status, kind, attendees, expires_at, proposal_for, source, google_id, task_id, prep_answers, urgent, created_at"
        )
        .neq("status", "cancelled")
        .gte("start_at", nowIso)
        .or(`owner_id.eq.${user.id},attendees.cs.{${user.id}}`)
        .order("start_at", { ascending: true })
        .limit(1)
      if (!cancelled) setNext(((data as CalEvent[]) ?? [])[0] ?? null)
    }

    load()
    const channel = supabase
      .channel(`next-meeting-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, load)
      .subscribe()
    const interval = window.setInterval(load, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user])

  return next
}
