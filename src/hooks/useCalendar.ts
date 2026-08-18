import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"
import type { CalEvent } from "../lib/calendarUtils"
import type { Json } from "../types/supabase"

// ──────────────────────────────────────────────────────────────────────────────
// Estado global de eventos del calendario (Supabase + realtime).
// Carga colaborativa: todos los eventos visibles (RLS = autenticado).
// El componente filtra por propietario/asistente según la vista.
// ──────────────────────────────────────────────────────────────────────────────

const COLS =
  "id, owner_id, title, description, start_at, end_at, color, status, kind, attendees, expires_at, proposal_for, source, google_id, task_id, prep_answers, urgent, created_at"

export type NewEvent = {
  title: string
  description?: string
  start_at: string
  end_at: string
  color?: string
  status?: CalEvent["status"]
  kind?: CalEvent["kind"]
  attendees?: string[]
  expires_at?: string | null
  proposal_for?: string | null
  task_id?: string | null
  prep_answers?: Json | null
  urgent?: boolean
}

export function useCalendar(user: User | null) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from("calendar_events")
      .select(COLS)
      .order("start_at", { ascending: true })
    setEvents((data as CalEvent[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime colaborativo
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("calendar-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  const create = useCallback(
    async (ev: NewEvent): Promise<CalEvent | null> => {
      if (!user) return null
      const row = {
        owner_id: user.id,
        title: ev.title || "Evento",
        description: ev.description ?? "",
        start_at: ev.start_at,
        end_at: ev.end_at,
        color: ev.color ?? "#c2542f",
        status: ev.status ?? "confirmed",
        kind: ev.kind ?? "event",
        attendees: ev.attendees ?? [],
        expires_at: ev.expires_at ?? null,
        proposal_for: ev.proposal_for ?? null,
        source: "local",
        task_id: ev.task_id ?? null,
        prep_answers: ev.prep_answers ?? null,
        urgent: ev.urgent ?? false,
      }
      const { data, error } = await supabase
        .from("calendar_events")
        .insert(row)
        .select(COLS)
        .single()
      if (error) {
        console.error(error)
        return null
      }
      const created = data as CalEvent
      setEvents((p) => [...p, created])
      return created
    },
    [user]
  )

  const update = useCallback(
    async (id: string, patch: Partial<CalEvent>) => {
      setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)))
      const { error } = await supabase.from("calendar_events").update(patch).eq("id", id)
      if (error) {
        console.error(error)
        refresh()
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      setEvents((p) => p.filter((e) => e.id !== id))
      const { error } = await supabase.from("calendar_events").delete().eq("id", id)
      if (error) {
        console.error(error)
        refresh()
      }
    },
    [refresh]
  )

  return { events, loading, refresh, create, update, remove }
}
