import { useEffect, useState } from "react"
import { supabase } from "../supabase"

// ──────────────────────────────────────────────────────────────────────────────
// ¿Ha terminado este usuario el onboarding?
//
// Lo consulta RequireAuth en cada ruta privada, así que el resultado se cachea
// a nivel de módulo: sin caché sería una consulta por navegación, y encima el
// parpadeo de "cargando" en cada cambio de página.
// ──────────────────────────────────────────────────────────────────────────────

const cache = new Map<string, boolean>()

/** Se llama al terminar el onboarding para que la guardia no rebote de vuelta. */
export function markOnboardingDone(userId: string): void {
  cache.set(userId, true)
}

export function useOnboardingDone(userId: string | null): {
  done: boolean
  loading: boolean
} {
  const cached = userId ? cache.get(userId) : undefined
  const [done, setDone] = useState(cached ?? false)
  const [loading, setLoading] = useState(cached === undefined)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    const hit = cache.get(userId)
    if (hit !== undefined) {
      setDone(hit)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    supabase
      .from("users")
      .select("onboarding_done_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        // Fail-open ante un fallo de red: preferimos dejar pasar a alguien sin
        // onboarding que encerrar a un usuario ya registrado en un bucle.
        const value = error ? true : data?.onboarding_done_at != null
        if (!error) cache.set(userId, value)
        setDone(value)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  return { done, loading }
}
