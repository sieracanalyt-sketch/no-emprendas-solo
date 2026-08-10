// ──────────────────────────────────────────────────────────────────────────────
// Tema claro / oscuro.
//
// Todo el sistema de color vive en tokens CSS (ver index.css). Cambiar de tema
// es únicamente poner data-theme="light" en <html>: ningún componente necesita
// saber en qué tema está.
//
// Precedencia: elección explícita del usuario (localStorage) > preferencia del
// sistema. Si el usuario nunca ha elegido, seguimos al sistema en vivo.
// ──────────────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark"

const STORAGE_KEY = "nes-theme"

/** Preferencia del SO. En SSR/entornos sin matchMedia, asumimos oscuro. */
export function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark"
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

/** Elección explícita del usuario, si la hay. */
export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === "light" || v === "dark" ? v : null
  } catch {
    // localStorage puede lanzar en modo privado / cookies bloqueadas
    return null
  }
}

export function resolveTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

/** Escribe el tema en el DOM. El atributo solo se pone en claro: el tema por
 *  defecto de :root ya es el oscuro, así no dependemos del orden de carga. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === "light") root.setAttribute("data-theme", "light")
  else root.removeAttribute("data-theme")
}

export function setTheme(theme: Theme): void {
  applyTheme(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // sin persistencia: el tema sigue aplicado en esta sesión
  }
}
