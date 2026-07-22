import { Navigate, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { useUser } from "../hooks/useUser"

// Guardia de rutas privadas. Antes NO existía: cualquier ruta era accesible sin
// sesión, así que si cancelabas el selector de cuentas de Google, Supabase te
// devolvía igualmente a /explorar (el redirectTo del OAuth) y entrabas en la
// app sin usuario — navbar y rutas montadas, pero todas las queries vacías.
//
// useUser() no resuelve `loading` hasta que supabase-js ha terminado de leer
// los tokens del hash de la URL, así que un login OAuth correcto nunca sufre un
// rebote a /login por llegar aquí antes de tiempo.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const [user, loading] = useUser()
  const location = useLocation()

  if (loading) return null
  if (user) return <>{children}</>

  // Cuando el usuario cancela (o Google devuelve un error), el callback deja
  // `#error=access_denied&...` en la URL. Lo trasladamos a /login como query
  // para poder explicar qué ha pasado en vez de dejar una pantalla en blanco.
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""))
  const query = new URLSearchParams(location.search)
  const authError = hash.get("error") ?? query.get("error")

  return <Navigate to={authError ? `/login?authError=${encodeURIComponent(authError)}` : "/login"} replace />
}
