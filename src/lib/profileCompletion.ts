// ──────────────────────────────────────────────────────────────────────────────
// Reglas de "perfil completo" para poder conectar en NES Connect.
//
// Un usuario NO puede conectar con otras personas hasta que su perfil esté
// completo: biografía de al menos MIN_BIO caracteres + el resto de apartados
// (nombre, proyecto y a quién busca) rellenados.
//
// Lógica pura y reutilizable (Explorar gatea el botón "Conectar"; Perfil la usa
// para mostrar el progreso y guiar al usuario).
// ──────────────────────────────────────────────────────────────────────────────

export const MIN_BIO = 150

export type ProfileLike = {
  nombre?: string | null
  biografia?: string | null
  proyecto?: string | null
  buscando?: string[] | null
}

export type ProfileCheckItem = {
  key: "nombre" | "biografia" | "proyecto" | "buscando"
  label: string
  ok: boolean
  /** Texto auxiliar opcional, p.ej. "120/150" para la biografía. */
  detail?: string
}

export type ProfileCheck = {
  complete: boolean
  bioLen: number
  missingCount: number
  items: ProfileCheckItem[]
}

/** Evalúa la completitud de un perfil y devuelve el detalle por apartado. */
export function checkProfile(p: ProfileLike | null | undefined): ProfileCheck {
  const nombre = (p?.nombre ?? "").trim()
  const bio = (p?.biografia ?? "").trim()
  const proyecto = (p?.proyecto ?? "").trim()
  const buscando = (p?.buscando ?? []).filter((t) => typeof t === "string" && t.trim() !== "")

  const items: ProfileCheckItem[] = [
    { key: "nombre", label: "Nombre", ok: nombre.length > 0 },
    {
      key: "biografia",
      label: `Biografía (mín. ${MIN_BIO} caracteres)`,
      ok: bio.length >= MIN_BIO,
      detail: `${bio.length}/${MIN_BIO}`,
    },
    { key: "proyecto", label: "Proyecto", ok: proyecto.length > 0 },
    { key: "buscando", label: "A quién buscas (al menos 1)", ok: buscando.length > 0 },
  ]

  const missingCount = items.filter((i) => !i.ok).length
  return { complete: missingCount === 0, bioLen: bio.length, missingCount, items }
}
