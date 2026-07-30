// ──────────────────────────────────────────────────────────────────────────────
// "MI DÍA" — capa individual de la Matriz de Eisenhower con AUTOLIMPIEZA.
//
// Plan diario por usuario (persistido en localStorage). Al cambiar el día:
//   · Tareas SIN completar de los cuadrantes 1 y 2 (importantes) → se arrastran
//     a hoy con etiqueta "Arrastrada/Pendiente".
//   · Tareas SIN completar de los cuadrantes 3 y 4 → vuelven al Backlog general
//     para liberar espacio mental (no se acumulan en Mi Día).
//   · Tareas completadas → salen del plan.
// ──────────────────────────────────────────────────────────────────────────────

import { deriveQuadrant, type EisenhowerTask } from "./eisenhower"

export type MyDayPlan = {
  date: string        // día al que pertenece el plan (clave local, ver dayKey)
  ids: string[]       // tareas elegidas para hoy
  carried: string[]   // subconjunto de ids que vienen arrastradas de días previos
  // Lo urgente e importante entra en Mi Día solo. `dismissed` guarda lo que
  // sacaste a mano para que no vuelva a colarse hoy; se limpia cada mañana.
  dismissed: string[]
}

type CleanTask = EisenhowerTask & { id: string; status: EisenhowerTask["status"] }

const KEY = (userId: string) => `nes_myday:${userId}`

/** Clave de día en hora local (no UTC) para que "hoy" coincida con el usuario. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function loadPlan(userId: string): MyDayPlan {
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (raw) {
      const p = JSON.parse(raw) as Partial<MyDayPlan>
      return { date: p.date ?? dayKey(), ids: p.ids ?? [], carried: p.carried ?? [], dismissed: p.dismissed ?? [] }
    }
  } catch { /* corrupto → plan limpio */ }
  return { date: dayKey(), ids: [], carried: [], dismissed: [] }
}

export function savePlan(userId: string, plan: MyDayPlan): void {
  localStorage.setItem(KEY(userId), JSON.stringify(plan))
}

export type AutocleanResult = {
  plan: MyDayPlan
  toBacklog: string[]  // ids que deben moverse al Backlog en el Kanban
  changed: boolean     // hubo rotación de día (para avisar al usuario)
}

/**
 * Aplica la autolimpieza si el plan pertenece a un día anterior a `today`.
 * Es idempotente: si el plan ya es de hoy, no hace nada.
 */
export function runAutoclean(
  plan: MyDayPlan,
  tasks: CleanTask[],
  today: string = dayKey(),
): AutocleanResult {
  if (plan.date === today) return { plan, toBacklog: [], changed: false }

  const byId = new Map(tasks.map(t => [t.id, t]))
  const keptIds: string[] = []
  const carried: string[] = []
  const toBacklog: string[] = []

  for (const id of plan.ids) {
    const t = byId.get(id)
    if (!t) continue                 // tarea borrada → se descarta
    if (t.status === "done") continue // completada → sale del plan
    const q = deriveQuadrant(t)
    if (q === 1 || q === 2) {
      keptIds.push(id)               // importante → se arrastra a hoy
      carried.push(id)
    } else {
      toBacklog.push(id)             // residuo → al Backlog general
    }
  }

  return {
    // Día nuevo: lo que descartaste ayer vuelve a poder entrar solo.
    plan: { date: today, ids: keptIds, carried, dismissed: [] },
    toBacklog,
    changed: true,
  }
}
