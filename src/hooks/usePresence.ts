import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"

// ──────────────────────────────────────────────────────────────────────────────
// Presencia online en tiempo real usando Supabase Realtime Presence.
// Todos los usuarios conectados se unen a un canal compartido y "trackean" su id.
// Devolvemos un Set con los ids de usuario actualmente en línea.
// ──────────────────────────────────────────────────────────────────────────────

export function usePresence(user: User | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel("presence:online", {
      config: { presence: { key: user.id } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return online
}
