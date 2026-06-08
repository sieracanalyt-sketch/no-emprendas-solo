// ──────────────────────────────────────────────────────────────────────────────
// Reglas de "perfil completo" para poder conectar en NES Connect.
//
// Requisitos:
//   1. Nombre no vacío
//   2. Biografía ≥ MIN_BIO caracteres
//   3. Proyecto definido: project_status en ('has_project','no_project','looking')
//      Si es 'has_project', el campo `proyecto` también debe tener texto.
//      Compatibilidad hacia atrás: si no hay project_status pero hay texto
//      en `proyecto`, se considera cumplido.
//   4. A quién buscas: al menos 1 tag
// ──────────────────────────────────────────────────────────────────────────────

export const MIN_BIO = 250

export type ProjectStatus = "has_project" | "no_project" | "looking" | null

export type ProfileLike = {
  nombre?: string | null
  biografia?: string | null
  proyecto?: string | null
  project_status?: string | null
  buscando?: string[] | null
}

export type ProfileCheckItem = {
  key: "nombre" | "biografia" | "proyecto" | "buscando"
  label: string
  ok: boolean
  /** Texto auxiliar opcional, p.ej. "120/250" para la biografía. */
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
  const projectStatus = p?.project_status
  const buscando = (p?.buscando ?? []).filter((t) => typeof t === "string" && t.trim() !== "")

  // Proyecto: cualquiera de las 3 opciones es válida; si es "has_project",
  // el campo de texto también debe tener contenido.
  const projectOk =
    projectStatus === "no_project" ||
    projectStatus === "looking" ||
    (projectStatus === "has_project" && proyecto.length > 0) ||
    // Compatibilidad hacia atrás: texto sin project_status
    (!projectStatus && proyecto.length > 0)

  const items: ProfileCheckItem[] = [
    { key: "nombre", label: "Nombre", ok: nombre.length > 0 },
    {
      key: "biografia",
      label: `Biografía (mín. ${MIN_BIO} caracteres)`,
      ok: bio.length >= MIN_BIO,
      detail: `${bio.length}/${MIN_BIO}`,
    },
    { key: "proyecto", label: "Proyecto", ok: projectOk },
    { key: "buscando", label: "A quién buscas (al menos 1)", ok: buscando.length > 0 },
  ]

  const missingCount = items.filter((i) => !i.ok).length
  return { complete: missingCount === 0, bioLen: bio.length, missingCount, items }
}
