// ──────────────────────────────────────────────────────────────────────────────
// Read-tracking sin tocar el esquema de la base de datos.
// Guardamos en localStorage la última vez (timestamp ms) que el usuario abrió
// cada conversación. Comparándolo con la fecha del último mensaje calculamos
// los mensajes no leídos en el cliente.
// ──────────────────────────────────────────────────────────────────────────────

const KEY = (convKey: string) => `nes:lastRead:${convKey}`

/** Clave de conversación: `chat:<chatId>` o `group:<groupId>` */
export function getLastRead(convKey: string): number {
  const v = localStorage.getItem(KEY(convKey))
  return v ? Number(v) : 0
}

export function setLastRead(convKey: string, ts: number = Date.now()): void {
  localStorage.setItem(KEY(convKey), String(ts))
}

/** Devuelve el timestamp como ISO para comparar en consultas a Supabase. */
export function lastReadIso(convKey: string): string {
  return new Date(getLastRead(convKey)).toISOString()
}
