import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"

export async function saveUser(user: User) {
  try {
    const today     = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("users")
      .select("id, streak_days, streak_last_date")
      .eq("id", user.id)
      .single()

    if (error || !data) {
      // Usuario nuevo o error de lectura: intentar upsert básico
      await supabase.from("users").upsert({
        id: user.id,
        email: user.email ?? null,
        nombre: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
        avatar: user.user_metadata?.avatar_url ?? null,
        last_login: new Date().toISOString(),
        streak_days: 1,
        streak_last_date: today,
      }, { onConflict: "id", ignoreDuplicates: false })
      return
    }

    // Usuario existente: calcular nueva racha
    const lastDate      = (data as Record<string, unknown>).streak_last_date as string | null
    const currentStreak = ((data as Record<string, unknown>).streak_days as number) ?? 0

    if (lastDate === today) {
      // Ya activo hoy: solo refrescar last_login
      await supabase.from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", user.id)
      return
    }

    const newStreak = lastDate === yesterday ? currentStreak + 1 : 1

    await supabase.from("users").update({
      last_login: new Date().toISOString(),
      streak_days: newStreak,
      streak_last_date: today,
    }).eq("id", user.id)
  } catch {
    // Nunca dejar que saveUser rompa el flujo de autenticación
  }
}
