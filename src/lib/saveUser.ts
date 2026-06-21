import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"

// Registra el día de hoy en el mapa de actividad (1 fila por usuario-día).
// Si ya existe, suma 1 al peso → celdas más intensas en días con más actividad.
async function bumpActivity(userId: string, today: string) {
  try {
    const { data } = await supabase
      .from("user_activity")
      .select("weight")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle()

    const weight = ((data as { weight?: number } | null)?.weight ?? 0) + 1
    await supabase
      .from("user_activity")
      .upsert({ user_id: userId, day: today, weight }, { onConflict: "user_id,day" })
  } catch {
    // La actividad es accesoria: nunca debe romper el login.
  }
}

export async function saveUser(user: User) {
  try {
    const today     = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("users")
      .select("id, streak_days, streak_last_date, streak_best")
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
        streak_best: 1,
        streak_last_date: today,
      }, { onConflict: "id", ignoreDuplicates: false })
      await bumpActivity(user.id, today)
      return
    }

    // Usuario existente: calcular nueva racha
    const d             = data as Record<string, unknown>
    const lastDate      = d.streak_last_date as string | null
    const currentStreak = (d.streak_days as number) ?? 0
    const bestStreak    = (d.streak_best as number) ?? 0

    if (lastDate === today) {
      // Ya activo hoy: solo refrescar last_login + sumar peso de actividad
      await supabase.from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", user.id)
      await bumpActivity(user.id, today)
      return
    }

    const newStreak = lastDate === yesterday ? currentStreak + 1 : 1
    const newBest   = Math.max(bestStreak, newStreak)

    await supabase.from("users").update({
      last_login: new Date().toISOString(),
      streak_days: newStreak,
      streak_best: newBest,
      streak_last_date: today,
    }).eq("id", user.id)

    await bumpActivity(user.id, today)
  } catch {
    // Nunca dejar que saveUser rompa el flujo de autenticación
  }
}
