import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"
import { lastReadIso } from "../lib/reads"
import { chatListComparator } from "../lib/matchDeadline"

// ──────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
// ──────────────────────────────────────────────────────────────────────────────
export type ChatListItem = {
  chatId: string
  otherUserId: string
  name: string
  avatar: string | null
  lastText: string
  timestamp: string | null
  unread: number
  /** true si el último mensaje lo envié yo (null = chat sin mensajes) */
  lastFromMe: boolean | null
}

export type GroupListItem = {
  id: string
  name: string
  membersCount: number
  lastText: string
  timestamp: string | null
  unread: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Lista de chats privados del usuario (con último mensaje, no leídos y realtime)
// ──────────────────────────────────────────────────────────────────────────────
export function useChatList(user: User | null) {
  const [items, setItems] = useState<ChatListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return

    const { data: chats } = await supabase
      .from("chats")
      .select("id, user1_id, user2_id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

    if (!chats) {
      setItems([])
      setLoading(false)
      return
    }

    const list = await Promise.all(
      chats.map(async (chat): Promise<ChatListItem> => {
        const otherUserId =
          chat.user1_id === user.id ? chat.user2_id : chat.user1_id

        const [{ data: lastMsgs }, { data: otherUser }, { count }] =
          await Promise.all([
            supabase
              .from("messages")
              .select("text, created_at, from_uid")
              .eq("chat_id", chat.id)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("users")
              .select("nombre, avatar")
              .eq("id", otherUserId)
              .single(),
            supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("chat_id", chat.id)
              .neq("from_uid", user.id)
              .gt("created_at", lastReadIso(`chat:${chat.id}`)),
          ])

        const last = lastMsgs?.[0]
        return {
          chatId: chat.id,
          otherUserId,
          name: otherUser?.nombre || "Usuario",
          avatar: otherUser?.avatar ?? null,
          lastText: last?.text ?? "",
          timestamp: last?.created_at ?? null,
          unread: count ?? 0,
          lastFromMe: last ? last.from_uid === user.id : null,
        }
      })
    )

    // FIFO social: primero los matches que esperan TU respuesta (72 h),
    // el más urgente arriba; después el resto por actividad.
    list.sort(chatListComparator)

    setItems(list)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime: cualquier mensaje privado nuevo refresca la lista
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`chats-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  return { items, loading, refresh }
}

// ──────────────────────────────────────────────────────────────────────────────
// Lista de grupos a los que pertenece el usuario
// ──────────────────────────────────────────────────────────────────────────────
export function useGroupList(user: User | null) {
  const [items, setItems] = useState<GroupListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return

    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, members")

    if (!groups) {
      setItems([])
      setLoading(false)
      return
    }

    // Filtrado por membresía en cliente (robusto ante el tipo de la columna)
    const mine = groups.filter(
      (g) => Array.isArray(g.members) && g.members.includes(user.id)
    )

    const list = await Promise.all(
      mine.map(async (g): Promise<GroupListItem> => {
        const [{ data: lastMsgs }, { count }] = await Promise.all([
          supabase
            .from("group_messages")
            .select("text, created_at")
            .eq("group_id", g.id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("group_messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", g.id)
            .neq("from_uid", user.id)
            .gt("created_at", lastReadIso(`group:${g.id}`)),
        ])

        const last = lastMsgs?.[0]
        return {
          id: g.id,
          name: g.name,
          membersCount: g.members?.length ?? 0,
          lastText: last?.text ?? "Sin mensajes aún",
          timestamp: last?.created_at ?? null,
          unread: count ?? 0,
        }
      })
    )

    list.sort(
      (a, b) =>
        new Date(b.timestamp ?? 0).getTime() -
        new Date(a.timestamp ?? 0).getTime()
    )

    setItems(list)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime: cualquier mensaje de grupo nuevo refresca la lista
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`groups-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  return { items, loading, refresh }
}
