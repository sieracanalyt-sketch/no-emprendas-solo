import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { EMPTY_METRICS, type ProfileMetrics } from "../lib/gamification"

// Carga las métricas de gamificación de un usuario (propio o ajeno) vía la RPC
// `get_profile_metrics`, que agrega recuentos sorteando la RLS sin exponer
// contenido privado. Una sola llamada de red por perfil.
export function useProfileMetrics(userId: string | null | undefined) {
  const [metrics, setMetrics] = useState<ProfileMetrics>(EMPTY_METRICS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    supabase
      .rpc("get_profile_metrics", { target: userId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) {
          setMetrics({ ...EMPTY_METRICS, ...(data as Partial<ProfileMetrics>) })
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  return { metrics, loading }
}
