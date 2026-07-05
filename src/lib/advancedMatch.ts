// ──────────────────────────────────────────────────────────────────────────────
// MATCHMAKING AVANZADO — la capa premium de NES Connect.
//
// El match básico (matchmaking.ts) cruza tokens de bio/proyecto. Este añade una
// capa psicométrica basada en cuatro libros reales, para emparejamientos mucho
// más precisos entre fundadores:
//   · Rocket Fuel (Wickman)          → arquetipo Visionario/Integrador
//   · The 6 Types of Working Genius  → genios y frustraciones (Lencioni)
//   · Give and Take (Adam Grant)     → reciprocidad Giver/Matcher/Taker
//   · Rodeado de Idiotas / DISC      → estilo de comunicación
//
// Los datos viven en la tabla `match_profiles` (solo premium puede escribir, RLS).
// La puntuación la calcula el RPC `nes_match_advanced` en el servidor: determinista,
// explicable y SIN datos inventados (si no hay perfiles, devuelve vacío + gaps).
// ──────────────────────────────────────────────────────────────────────────────
import { supabase } from "../supabase"

export type Archetype = "visionary" | "integrator" | "balanced"
export type Reciprocity = "giver" | "matcher" | "taker"
export type Disc = "red" | "yellow" | "green" | "blue"
export type Genius =
  | "wonder" | "invention" | "discernment" | "galvanizing" | "enablement" | "tenacity"

export type MatchProfileFields = {
  archetype: Archetype | null
  genius: Genius[]
  frustration: Genius[]
  reciprocity: Reciprocity | null
  disc: Disc | null
  offers: string[]
  needs: string[]
  superpower: string | null
}

export const EMPTY_PROFILE: MatchProfileFields = {
  archetype: null, genius: [], frustration: [], reciprocity: null, disc: null,
  offers: [], needs: [], superpower: null,
}

// ── etiquetas (espejo de agent/match_knowledge.py) ──────────────────────────
export const ARCHETYPES: { value: Archetype; label: string; hint: string }[] = [
  { value: "visionary", label: "Visionario", hint: "Ideas, dirección, energía (Rocket Fuel)" },
  { value: "integrator", label: "Integrador", hint: "Ejecución, cohesión, cierre" },
  { value: "balanced", label: "Equilibrado", hint: "Flexo entre ambos" },
]

export const GENIUSES: { value: Genius; label: string; hint: string }[] = [
  { value: "wonder", label: "Asombro", hint: "Cuestionar y ver el potencial" },
  { value: "invention", label: "Invención", hint: "Crear soluciones nuevas" },
  { value: "discernment", label: "Discernimiento", hint: "Buen instinto y criterio" },
  { value: "galvanizing", label: "Estímulo", hint: "Movilizar a la gente a actuar" },
  { value: "enablement", label: "Facilitación", hint: "Ayudar y apoyar" },
  { value: "tenacity", label: "Tenacidad", hint: "Empujar hasta terminar" },
]

export const RECIPROCITIES: { value: Reciprocity; label: string; hint: string }[] = [
  { value: "giver", label: "Generoso", hint: "Aporta sin llevar la cuenta (Give and Take)" },
  { value: "matcher", label: "Equilibrador", hint: "Intercambio justo, toma y daca" },
  { value: "taker", label: "Estratega", hint: "Optimiza para sí mismo" },
]

export const DISCS: { value: Disc; label: string; hint: string; color: string }[] = [
  { value: "red", label: "Rojo", hint: "Directo, rápido, orientado a resultados", color: "#ff5a5f" },
  { value: "yellow", label: "Amarillo", hint: "Social, optimista, persuasivo", color: "#ffca3a" },
  { value: "green", label: "Verde", hint: "Estable, paciente, de apoyo", color: "#3fca7d" },
  { value: "blue", label: "Azul", hint: "Preciso, analítico, cuidadoso", color: "#4f8cff" },
]

// ── resultados del motor (espejo de CONTRACT.md §4.7) ───────────────────────
export type AdvancedReason = { framework: string; text: string }
export type AdvancedPair = {
  a: string; b: string; score: number; mutual: boolean; reasons: AdvancedReason[]
}
export type AdvancedGaps = {
  total_members?: number; premium_members?: number
  advanced_profiles?: number; eligible?: number; free_members?: number
}
export type AdvancedResult = {
  generated: string | null; engine?: string
  pairs: AdvancedPair[]; gaps: AdvancedGaps; unavailable?: string
}

// ── acceso a datos ───────────────────────────────────────────────────────────

export async function loadMatchProfile(userId: string): Promise<MatchProfileFields> {
  const { data } = await supabase
    .from("match_profiles")
    .select("archetype, genius, frustration, reciprocity, disc, offers, needs, superpower")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return { ...EMPTY_PROFILE }
  return {
    archetype: data.archetype ?? null,
    genius: data.genius ?? [],
    frustration: data.frustration ?? [],
    reciprocity: data.reciprocity ?? null,
    disc: data.disc ?? null,
    offers: data.offers ?? [],
    needs: data.needs ?? [],
    superpower: data.superpower ?? null,
  }
}

/** Upsert del perfil avanzado. La RLS solo deja escribir a premium/trial/admin. */
export async function saveMatchProfile(
  userId: string,
  f: MatchProfileFields,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("match_profiles").upsert(
    { user_id: userId, ...f, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )
  return { error: error?.message }
}

/** Un perfil "cuenta" para el motor cuando al menos tiene arquetipo. */
export function isProfileReady(f: MatchProfileFields): boolean {
  return f.archetype != null
}

export async function fetchAdvancedMatches(limit = 6): Promise<AdvancedResult> {
  const { data, error } = await supabase.rpc("nes_match_advanced", { limit_n: limit })
  if (error) {
    return { generated: null, engine: "advanced", pairs: [], gaps: {}, unavailable: error.message }
  }
  return (data as AdvancedResult) ?? { generated: null, engine: "advanced", pairs: [], gaps: {} }
}

export const FRAMEWORK_COLOR: Record<string, string> = {
  "Rocket Fuel": "#5e6ad2",
  "Working Genius": "#8b7bff",
  "Give and Take": "#3fca7d",
  DISC: "#ffca3a",
  Necesidades: "#ff7ac2",
}
