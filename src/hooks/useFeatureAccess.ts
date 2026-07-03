import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUserTier } from "./useUserTier"
import { tierAtLeast, type FeatureFlag } from "../lib/premium"

// ──────────────────────────────────────────────────────────────────────────────
// Acceso a features gated por flag + tier.
// Cache a nivel de módulo: los flags (4 filas) se cargan una vez por sesión y
// un único canal realtime los mantiene al día para todos los consumidores.
//
// Regla FAIL-OPEN (intencional): flag inexistente o con active=false ⇒
// allowed=true. El gating solo "muerde" cuando un admin enciende el flag desde
// /admin — así el deploy no quita acceso a nadie hoy.
// ──────────────────────────────────────────────────────────────────────────────

let flagsCache: FeatureFlag[] | null = null
let loadPromise: Promise<void> | null = null
let channelRefs = 0
let channel: ReturnType<typeof supabase.channel> | null = null
const listeners = new Set<() => void>()

async function fetchFlags(): Promise<void> {
  const { data } = await supabase.from("feature_flags").select("feature, min_tier, active")
  flagsCache = (data as FeatureFlag[]) ?? []
  listeners.forEach((fn) => fn())
}

function loadFlags(): Promise<void> {
  if (!loadPromise) loadPromise = fetchFlags()
  return loadPromise
}

function subscribeToFlags(onChange: () => void): () => void {
  listeners.add(onChange)
  channelRefs++
  if (!channel) {
    channel = supabase
      .channel("feature-flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flags" },
        () => {
          loadPromise = null
          loadFlags()
        }
      )
      .subscribe()
  }
  return () => {
    listeners.delete(onChange)
    channelRefs--
    if (channelRefs === 0 && channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }
}

export type FeatureAccess = {
  allowed: boolean
  flagActive: boolean
  loading: boolean
}

export function useFeatureAccess(feature: string): FeatureAccess {
  const { tier, isAdmin, loading: tierLoading } = useUserTier()
  const [flags, setFlags] = useState<FeatureFlag[] | null>(flagsCache)

  useEffect(() => {
    const sync = () => setFlags(flagsCache ? [...flagsCache] : null)
    const unsubscribe = subscribeToFlags(sync)
    loadFlags().then(sync)
    return unsubscribe
  }, [])

  const loading = tierLoading || flags === null
  const flag = flags?.find((f) => f.feature === feature) ?? null
  const flagActive = flag?.active === true

  // Fail-open: sin flag o inactivo ⇒ acceso libre.
  const allowed = !flagActive || isAdmin || (flag !== null && tierAtLeast(tier, flag.min_tier))

  return { allowed, flagActive, loading }
}

// Lista completa de flags con realtime (para la página /admin)
export function useFeatureFlags(): { flags: FeatureFlag[]; loading: boolean } {
  const [flags, setFlags] = useState<FeatureFlag[] | null>(flagsCache)

  useEffect(() => {
    const sync = () => setFlags(flagsCache ? [...flagsCache] : null)
    const unsubscribe = subscribeToFlags(sync)
    loadFlags().then(sync)
    return unsubscribe
  }, [])

  return { flags: flags ?? [], loading: flags === null }
}
