import { useCallback, useEffect, useState } from "react"
import { applyTheme, resolveTheme, setTheme, storedTheme, systemTheme, type Theme } from "../lib/theme"

// Estado de tema compartido a nivel de módulo: varios componentes (navbar de
// escritorio y tab bar móvil) pueden montar el toggle a la vez y deben quedar
// sincronizados sin pasar props por medio árbol.
let current: Theme = typeof document === "undefined" ? "dark" : resolveTheme()
const listeners = new Set<(t: Theme) => void>()

function broadcast(t: Theme) {
  current = t
  listeners.forEach((l) => l(t))
}

/** Devuelve el tema activo y una función para alternarlo. */
export function useTheme(): [Theme, () => void] {
  const [theme, setLocal] = useState<Theme>(current)

  useEffect(() => {
    listeners.add(setLocal)
    // El script de index.html ya pintó el tema antes de montar React; esto
    // solo re-sincroniza por si acaso (p. ej. tras un hot reload).
    applyTheme(current)
    return () => { listeners.delete(setLocal) }
  }, [])

  // Si el usuario nunca eligió explícitamente, seguimos al SO en vivo.
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => {
      if (storedTheme()) return
      const next = systemTheme()
      applyTheme(next)
      broadcast(next)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = current === "light" ? "dark" : "light"
    setTheme(next)
    broadcast(next)
  }, [])

  return [theme, toggle]
}
