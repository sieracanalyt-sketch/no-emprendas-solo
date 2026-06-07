import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"

export async function saveUser(user: User) {
  const { data } = await supabase.from("users").select("id").eq("id", user.id).single()
  if (!data) {
    await supabase.from("users").insert({
      id: user.id,
      email: user.email ?? null,
      nombre: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
      avatar: user.user_metadata?.avatar_url ?? null,
      last_login: new Date().toISOString(),
    })
    return
  }
  // Refresca la marca de actividad en cada inicio de sesión: alimenta el filtro
  // anti-ghosting de NES Connect (perfiles inactivos pierden visibilidad).
  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id)
}
