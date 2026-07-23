import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "./useUser"
import type { Subscription, Tier } from "../lib/premium"

// ──────────────────────────────────────────────────────────────────────────────
// Tier efectivo del usuario actual (users.tier + subscriptions + trial).
// Reglas:
//   - Base: users.tier (permite toggles manuales de QA sin subscription).
//   - Si su subscription más reciente NO está 'active' → free.
//   - Si trial_until está en el futuro → premium (prevalece).
//
// Estado y canal realtime COMPARTIDOS a nivel de módulo: varios componentes
// usan este hook a la vez (Navbar, FeatureGated, Admin...) y supabase.channel()
// devuelve la MISMA instancia para un topic repetido — llamar a .on() sobre un
// canal ya suscrito LANZA una excepción y desmontaría toda la app (pantalla
// negra). Un único canal por usuario + listeners evita el problema de raíz.
// ──────────────────────────────────────────────────────────────────────────────

export type UserTierState = {
  tier: Tier
  isAdmin: boolean
  trialUntil: Date | null
  subscription: Subscription | null
  loading: boolean
}

const INITIAL: UserTierState = {
  tier: "free",
  isAdmin: false,
  trialUntil: null,
  subscription: null,
  loading: true,
}

let snapshot: UserTierState = INITIAL
let currentUserId: string | null = null
let channel: ReturnType<typeof supabase.channel> | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

async function refreshTier(userId: string, attempt = 0): Promise<void> {
  const [{ data: row, error: userErr }, { data: subs }] = await Promise.all([
    supabase.from("users").select("tier, trial_until, is_admin").eq("id", userId).single(),
    supabase
      .from("subscriptions")
      .select("id, user_id, tier, status, partner_id, next_billing_date, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ])
  if (currentUserId !== userId) return // respuesta obsoleta (logout/cambio de usuario)

  // Fallo transitorio (p.ej. la sesión todavía se está restaurando al recargar
  // directamente en una ruta como /admin): reintentar en vez de asumir free/no-admin,
  // que dejaría a un admin real fuera de /admin sin motivo real.
  if (userErr) {
    if (attempt < 3) {
      setTimeout(() => { if (currentUserId === userId) void refreshTier(userId, attempt + 1) }, 400)
    } else {
      snapshot = { ...snapshot, loading: false }
      notify()
    }
    return
  }

  const sub = ((subs as Subscription[]) ?? [])[0] ?? null
  const trialUntil = row?.trial_until ? new Date(row.trial_until) : null

  let tier: Tier = (row?.tier as Tier) ?? "free"
  if (sub && sub.status !== "active") tier = "free"
  if (trialUntil && trialUntil.getTime() > Date.now()) tier = "premium"

  snapshot = {
    tier,
    isAdmin: row?.is_admin === true,
    trialUntil,
    subscription: sub,
    loading: false,
  }
  notify()
}

// Prepara (una sola vez por usuario) el fetch y el canal realtime compartido.
function ensureUser(userId: string | null): void {
  if (userId === currentUserId) return

  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
  currentUserId = userId

  if (!userId) {
    snapshot = { ...INITIAL, loading: false }
    notify()
    return
  }

  snapshot = INITIAL
  notify()
  refreshTier(userId)
  // Sufijo único: nunca reutilizar un topic (channel() devuelve la instancia
  // vieja si el topic coincide y .on() sobre un canal ya suscrito lanza).
  channel = supabase
    .channel(`user-tier:${userId}:${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
      () => refreshTier(userId)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
      () => refreshTier(userId)
    )
    .subscribe()
}

export function useUserTier(): UserTierState {
  const [user] = useUser()
  const [state, setState] = useState<UserTierState>(snapshot)

  useEffect(() => {
    const sync = () => setState(snapshot)
    listeners.add(sync)
    ensureUser(user?.id ?? null)
    sync()
    return () => {
      listeners.delete(sync)
    }
  }, [user?.id])

  return state
}
