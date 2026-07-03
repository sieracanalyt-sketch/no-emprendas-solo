import { useCallback, useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "./useUser"
import type { Subscription, Tier } from "../lib/premium"

// ──────────────────────────────────────────────────────────────────────────────
// Tier efectivo del usuario actual (users.tier + subscriptions + trial).
// Reglas:
//   - Base: users.tier (permite toggles manuales de QA sin subscription).
//   - Si su subscription más reciente NO está 'active' → free.
//   - Si trial_until está en el futuro → premium (prevalece).
// Realtime: cambios en su fila de users o en sus subscriptions refrescan al
// instante (el admin puede cambiar el tier y la UI reacciona sin recargar).
// ──────────────────────────────────────────────────────────────────────────────

export type UserTierState = {
  tier: Tier
  isAdmin: boolean
  trialUntil: Date | null
  subscription: Subscription | null
  loading: boolean
}

export function useUserTier(): UserTierState {
  const [user] = useUser()
  const [state, setState] = useState<UserTierState>({
    tier: "free",
    isAdmin: false,
    trialUntil: null,
    subscription: null,
    loading: true,
  })

  const refresh = useCallback(async () => {
    if (!user) return
    const [{ data: row }, { data: subs }] = await Promise.all([
      supabase.from("users").select("tier, trial_until, is_admin").eq("id", user.id).single(),
      supabase
        .from("subscriptions")
        .select("id, user_id, tier, status, partner_id, next_billing_date, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ])

    const sub = ((subs as Subscription[]) ?? [])[0] ?? null
    const trialUntil = row?.trial_until ? new Date(row.trial_until) : null

    let tier: Tier = (row?.tier as Tier) ?? "free"
    if (sub && sub.status !== "active") tier = "free"
    if (trialUntil && trialUntil.getTime() > Date.now()) tier = "premium"

    setState({
      tier,
      isAdmin: row?.is_admin === true,
      trialUntil,
      subscription: sub,
      loading: false,
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      setState((p) => (p.loading ? { ...p, loading: false } : p))
      return
    }
    refresh()
  }, [user, refresh])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`user-tier:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  return state
}
