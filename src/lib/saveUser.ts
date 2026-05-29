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
    })
  }
}
