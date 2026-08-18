import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"
import { NUCLEO, type GroupStatus, type Stage } from "../lib/config/nucleos"

// ──────────────────────────────────────────────────────────────────────────────
// El núcleo del usuario. Lo tiene el 100 % de los usuarios y solo puede haber
// uno (índice único en la base), así que esto devuelve uno o ninguno.
//
// El chat se abre a partir de NUCLEO.CHAT_UNLOCK_AT miembros. Lo que se calcula
// aquí es solo para pintar: la puerta de verdad está en la política de INSERT
// de `group_messages`, que un cliente no puede saltarse.
// ──────────────────────────────────────────────────────────────────────────────

export type NucleoMember = {
  id: string
  nombre: string
  avatar: string | null
}

export type Nucleo = {
  id: string
  name: string
  stage: Stage | null
  status: GroupStatus
  seasonEndsAt: string | null
  members: NucleoMember[]
  memberCount: number
  /** Chat abierto (4+). Por debajo la fila se ve pero no abre conversación. */
  chatUnlocked: boolean
  /** Sitios que faltan para los 6 de un núcleo completo. 0 si ya están. */
  missingForFull: number
}

export function useNucleo(user: User | null) {
  const [nucleo, setNucleo] = useState<Nucleo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setNucleo(null)
      setLoading(false)
      return
    }

    // 1. ¿En qué núcleo estoy? (RLS: solo veo grupos de los que soy miembro)
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)
      .eq("type", "nucleo")
      .is("left_at", null)
      .maybeSingle()

    if (!membership) {
      setNucleo(null)
      setLoading(false)
      return
    }

    const { data: group } = await supabase
      .from("groups")
      .select("id, name, stage, status, season_ends_at")
      .eq("id", membership.group_id)
      .maybeSingle()

    if (!group) {
      setNucleo(null)
      setLoading(false)
      return
    }

    // 2. Quién más está dentro
    const { data: rows } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", group.id)
      .is("left_at", null)
      .order("joined_at", { ascending: true })

    const ids = (rows ?? []).map((r) => r.user_id)
    let members: NucleoMember[] = []
    if (ids.length) {
      const { data: people } = await supabase
        .from("users")
        .select("id, nombre, avatar")
        .in("id", ids)
      const byId = new Map((people ?? []).map((p) => [p.id, p]))
      members = ids.flatMap((id) => {
        const p = byId.get(id)
        return p ? [{ id: p.id, nombre: p.nombre || "Alguien", avatar: p.avatar }] : []
      })
    }

    const memberCount = ids.length
    setNucleo({
      id: group.id,
      name: group.name,
      stage: group.stage,
      status: group.status,
      seasonEndsAt: group.season_ends_at,
      members,
      memberCount,
      chatUnlocked: memberCount >= NUCLEO.CHAT_UNLOCK_AT,
      missingForFull: Math.max(0, NUCLEO.MIN_SIZE - memberCount),
    })
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Realtime: si entra o sale gente, el contador se mueve solo. Topic con
  // sufijo único — reutilizar un topic ya suscrito revienta el canal.
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`nucleo-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => { void refresh() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user, refresh])

  return { nucleo, loading, refresh }
}
