// ──────────────────────────────────────────────────────────────────────────────
// NES CONNECT — cola de descarte temporal ("Ignorar por ahora").
//
// Al pulsar "Ignorar", el ID del fundador entra en una cola local con caducidad
// de 14 días. Mientras no caduque, no vuelve a aparecer en el feed → contenido
// fresco. La cola se guarda por usuario (clave con su id) y persiste recargas.
//
// El esqueleto de servidor existe en `users.ignored_users` para sincronizar
// entre dispositivos en el futuro; la implementación activa es esta (localStorage).
// ──────────────────────────────────────────────────────────────────────────────

export const IGNORE_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 2 semanas

type IgnoreMap = Record<string, number> // otherUserId -> expira en (epoch ms)

const KEY = (userId: string) => `nes_ignored:${userId}`

function read(userId: string): IgnoreMap {
  try {
    return JSON.parse(localStorage.getItem(KEY(userId)) ?? "{}") as IgnoreMap
  } catch {
    return {}
  }
}

function write(userId: string, map: IgnoreMap): void {
  localStorage.setItem(KEY(userId), JSON.stringify(map))
}

/** Limpia entradas caducadas y devuelve el Set de IDs aún ignorados. */
export function getIgnored(userId: string): Set<string> {
  const map = read(userId)
  const now = Date.now()
  let mutated = false
  for (const id of Object.keys(map)) {
    if (map[id] <= now) { delete map[id]; mutated = true }
  }
  if (mutated) write(userId, map)
  return new Set(Object.keys(map))
}

/** Añade a la cola de descarte (caduca en `ttl` ms, 14 días por defecto). */
export function ignoreUser(userId: string, otherId: string, ttl = IGNORE_TTL_MS): void {
  const map = read(userId)
  map[otherId] = Date.now() + ttl
  write(userId, map)
}

/** Re-mostrar manualmente a alguien (sacarlo de la cola). */
export function restoreUser(userId: string, otherId: string): void {
  const map = read(userId)
  if (map[otherId]) { delete map[otherId]; write(userId, map) }
}

export function ignoredCount(userId: string): number {
  return getIgnored(userId).size
}
