// ──────────────────────────────────────────────────────────────────────────────
// Deadline social de los matches — 72 h para responder.
//
// En NES, un chat ES un match. Cuando la otra persona te escribe y no
// contestas, un contador de 72 h corre en tu contra: la misma lógica FIFO de
// cola que la waitlist del plan de verano, aplicada a conversaciones. Si el
// contador llega a cero, el match se "enfría" (y tu velocidad de respuesta
// alimenta el prestigio). Un mensaje lo reactiva — nada muere para siempre.
// ──────────────────────────────────────────────────────────────────────────────

export const RESPONSE_DEADLINE_MS = 72 * 60 * 60 * 1000 // 72 h

export type DeadlineInfo = {
  /** true → el último mensaje es del otro y me toca responder a MÍ */
  waitingYou: boolean
  /** true → yo escribí el último y espero SU respuesta */
  waitingThem: boolean
  /** milisegundos restantes (negativo si ya caducó) */
  msLeft: number
  expired: boolean
}

export function deadlineInfo(
  lastFromMe: boolean | null,
  lastAt: string | null,
): DeadlineInfo | null {
  if (lastFromMe === null || !lastAt) return null
  const elapsed = Date.now() - new Date(lastAt).getTime()
  if (Number.isNaN(elapsed)) return null
  const msLeft = RESPONSE_DEADLINE_MS - elapsed
  return {
    waitingYou: lastFromMe === false,
    waitingThem: lastFromMe === true,
    msLeft,
    expired: msLeft <= 0,
  }
}

/** "47 h" / "5 h" / "38 min" para el chip del contador. */
export function fmtTimeLeft(msLeft: number): string {
  const mins = Math.max(0, Math.floor(msLeft / 60000))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

/** Color del contador según urgencia: >24h índigo, >6h naranja, resto rojo. */
export function deadlineColor(msLeft: number): string {
  if (msLeft > 24 * 3600_000) return "#c7c2b3"
  if (msLeft > 6 * 3600_000) return "#f2994a"
  return "#eb5757"
}

/**
 * Orden FIFO de la lista de chats:
 *  1º los que esperan TU respuesta y aún no caducaron — el más antiguo primero
 *     (menos tiempo restante = más arriba, como una cola).
 *  2º el resto, por actividad reciente.
 */
export function chatListComparator<T extends { lastFromMe: boolean | null; timestamp: string | null }>(
  a: T,
  b: T,
): number {
  const da = deadlineInfo(a.lastFromMe, a.timestamp)
  const db = deadlineInfo(b.lastFromMe, b.timestamp)
  const aPending = !!da && da.waitingYou && !da.expired
  const bPending = !!db && db.waitingYou && !db.expired
  if (aPending !== bPending) return aPending ? -1 : 1
  if (aPending && bPending) return da!.msLeft - db!.msLeft
  return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
}
