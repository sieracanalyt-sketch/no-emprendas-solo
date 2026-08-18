// ──────────────────────────────────────────────────────────────────────────────
// Parámetros del núcleo. Fuente única para la interfaz.
//
// Ojo: MAX_SIZE y CHAT_UNLOCK_AT están replicados en SQL, dentro de
// `assign_nucleo` y `chat_unlocked` (migración 20260818130000_nucleos.sql).
// La base de datos es la que manda: es la que no se puede saltar desde el
// cliente. Si cambias un número aquí, cámbialo también allí.
// ──────────────────────────────────────────────────────────────────────────────

export const NUCLEO = {
  MIN_SIZE: 6,
  MAX_SIZE: 8,
  CHAT_UNLOCK_AT: 4,
  MAX_PER_USER: 1,
  SECTOR_DIVERSITY: true, // preferencia blanda, nunca bloquea
  SEASON_WEEKS: 8,
  AT_RISK_DAYS: 14,
  ARCHIVE_DAYS: 21,
} as const

export type Stage = "ideacion" | "aplicacion" | "facturacion"
export type GroupType = "nucleo" | "equipo"
export type GroupStatus = "forming" | "active" | "at_risk" | "archived"
export type MemberRole = "member" | "steward" | "founder"
export type InviteStatus = "pending" | "accepted" | "declined" | "expired"

/** Etiquetas de fase para la interfaz. */
export const STAGE_LABEL: Record<Stage, string> = {
  ideacion: "Ideación",
  aplicacion: "Aplicación",
  facturacion: "Facturación",
}
