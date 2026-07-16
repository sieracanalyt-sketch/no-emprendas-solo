// ──────────────────────────────────────────────────────────────────────────────
// MATCHMAKING AVANZADO — la capa premium de NES Connect.
//
// Rediseñado según el documento de investigación del fundador (jul 2026):
// 9 campos CONDUCTUALES cortos (nada de tests de personalidad — Sackett 2022:
// las muestras conductuales predicen mejor que los tests de rasgos). Lo que
// predice equipos que duran es la ALINEACIÓN (ambición, horas reales, ritmo,
// fiabilidad) + complementariedad funcional de roles, no la similitud.
//
// Los datos viven en `match_profiles` (RLS: solo premium/trial/admin escribe su
// fila). El ranking lo hace el motor Mergie (LLM) dentro del agente MERGE tras
// una entrevista corta por voz; cada ejecución se guarda en `match_requests`
// (RLS: cada usuario lee solo las suyas) y aquí mostramos la última.
//
// Este catálogo es espejo de agent/match_knowledge.py — si cambias uno, cambia
// el otro.
// ──────────────────────────────────────────────────────────────────────────────
import { supabase } from "../supabase"

export type Rol = "cofounder" | "lider_area" | "colaborador" | "explorando"
export type Fortaleza =
  | "producto" | "diseno" | "ventas" | "marketing" | "operaciones" | "estrategia" | "sector"
export type Horas = "lt5" | "5_15" | "15_30" | "full"
export type Fiabilidad = "me_quedo" | "aviso_equipo" | "pido_ayuda" | "me_agobio"
export type Conflicto = "directo" | "punto_medio" | "escuchar" | "dejar_pasar"
export type Tema =
  | "problema_vivido" | "dinero_libertad" | "aprender" | "impacto" | "demostrar" | "crear_gente"

export type MatchProfileFields = {
  rol_buscado: Rol | null
  fuerte_en: Fortaleza[]      // máx. 2 — evita el "todólogo" sin señal
  necesita: Fortaleza[]       // máx. 2 — el "encaje de cerradura"
  ambicion: number | null     // 1-4 (libertad ↔ ir a por todas)
  horas: Horas | null
  fiabilidad: Fiabilidad | null
  conflicto: Conflicto | null
  ritmo_plan: number | null       // 1 planificado … 4 improvisador
  ritmo_decision: number | null   // 1 decide rápido … 4 lo piensa bien
  importa: string | null          // máx. 200 caracteres
  temas: Tema[]
}

export const EMPTY_PROFILE: MatchProfileFields = {
  rol_buscado: null, fuerte_en: [], necesita: [], ambicion: null, horas: null,
  fiabilidad: null, conflicto: null, ritmo_plan: null, ritmo_decision: null,
  importa: null, temas: [],
}

// ── etiquetas (espejo de agent/match_knowledge.py) ──────────────────────────

export const ROLES: { value: Rol; label: string; hint: string }[] = [
  { value: "cofounder", label: "Co-founder", hint: "Socio 50/50 para el largo plazo" },
  { value: "lider_area", label: "Líder de un área", hint: "Alguien que lidere algo concreto: programar, vender…" },
  { value: "colaborador", label: "Colaborador puntual", hint: "Para un proyecto o reto concreto" },
  { value: "explorando", label: "Explorando", hint: "Todavía explorando, quiero conocer gente" },
]

export const FORTALEZAS: { value: Fortaleza; label: string }[] = [
  { value: "producto", label: "Construir el producto / programar" },
  { value: "diseno", label: "Diseño y experiencia de usuario" },
  { value: "ventas", label: "Vender y hablar con clientes" },
  { value: "marketing", label: "Marketing y redes" },
  { value: "operaciones", label: "Operaciones y organización" },
  { value: "estrategia", label: "Estrategia y visión de negocio" },
  { value: "sector", label: "Conocimiento profundo del sector" },
]

export const AMBICION: { value: number; label: string }[] = [
  { value: 1, label: "Un proyecto que me dé libertad e independencia, a mi manera" },
  { value: 2, label: "Un negocio estable que me dé buen dinero sin volverme loco" },
  { value: 3, label: "Crecer rápido aunque tenga que ceder control y meter socios/inversores" },
  { value: 4, label: "Construir algo enorme, ir a por todas aunque sea arriesgado" },
]

export const HORAS_OPTS: { value: Horas; label: string; hint: string }[] = [
  { value: "lt5", label: "Menos de 5h", hint: "Es un hobby por ahora" },
  { value: "5_15", label: "5-15h", hint: "En serio pero con clase/trabajo" },
  { value: "15_30", label: "15-30h", hint: "Mi prioridad después de lo obligatorio" },
  { value: "full", label: "Full-time", hint: "Todo lo que haga falta" },
]

export const FIABILIDAD_OPTS: { value: Fiabilidad; label: string }[] = [
  { value: "me_quedo", label: "Me quedo hasta arreglarlo, avise o no avise" },
  { value: "aviso_equipo", label: "Aviso enseguida al equipo y lo resolvemos juntos" },
  { value: "pido_ayuda", label: "Lo intento solo un rato y si no puedo, pido ayuda" },
  { value: "me_agobio", label: "Me agobio y a veces lo dejo para el día siguiente" },
]

export const CONFLICTO_OPTS: { value: Conflicto; label: string }[] = [
  { value: "directo", label: "Decirlo directo en el momento, sin rodeos" },
  { value: "punto_medio", label: "Buscar un punto medio para que nadie se sienta mal" },
  { value: "escuchar", label: "Escuchar primero y proponer una solución que combine ideas" },
  { value: "dejar_pasar", label: "Dejarlo pasar para no montar movida" },
]

export const TEMAS_OPTS: { value: Tema; label: string }[] = [
  { value: "problema_vivido", label: "Resolver un problema que he vivido" },
  { value: "dinero_libertad", label: "Ganar dinero y libertad" },
  { value: "aprender", label: "Aprender y crecer" },
  { value: "impacto", label: "Impacto social/ambiental" },
  { value: "demostrar", label: "Demostrar(me) que puedo" },
  { value: "crear_gente", label: "Crear algo con gente con la que me lo pase bien" },
]

// ── resultado del motor Mergie (espejo de src/jarvis/contract.ts) ────────────
export type MergieMatch = {
  posicion: number
  id_perfil: string
  nombre: string
  porque_encaja: string
  punto_fuerte: string
  a_hablar_desde_el_principio: string | null
  primer_paso: string
}
export type MergieResult = {
  generated?: string | null
  resumen?: string | null
  matches: MergieMatch[]
  nota_honesta?: string | null
  gaps?: { total_members?: number; premium_members?: number; advanced_profiles?: number }
}

// ── acceso a datos ───────────────────────────────────────────────────────────

const FIELDS =
  "rol_buscado, fuerte_en, necesita, ambicion, horas, fiabilidad, conflicto, ritmo_plan, ritmo_decision, importa, temas"

export async function loadMatchProfile(userId: string): Promise<MatchProfileFields> {
  const { data } = await supabase
    .from("match_profiles")
    .select(FIELDS)
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return { ...EMPTY_PROFILE }
  return {
    rol_buscado: data.rol_buscado ?? null,
    fuerte_en: data.fuerte_en ?? [],
    necesita: data.necesita ?? [],
    ambicion: data.ambicion ?? null,
    horas: data.horas ?? null,
    fiabilidad: data.fiabilidad ?? null,
    conflicto: data.conflicto ?? null,
    ritmo_plan: data.ritmo_plan ?? null,
    ritmo_decision: data.ritmo_decision ?? null,
    importa: data.importa ?? null,
    temas: data.temas ?? [],
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

/** Un perfil "cuenta" para el motor cuando al menos dice qué busca. */
export function isProfileReady(f: MatchProfileFields): boolean {
  return f.rol_buscado != null
}

/** Cuántos de los 9 campos están respondidos (para la barra de progreso). */
export function profileCompletion(f: MatchProfileFields): { done: number; total: number } {
  const done = [
    f.rol_buscado, f.fuerte_en.length > 0, f.necesita.length > 0, f.ambicion,
    f.horas, f.fiabilidad, f.conflicto, f.ritmo_plan != null && f.ritmo_decision != null,
    (f.importa ?? "").trim() !== "" || f.temas.length > 0,
  ].filter(Boolean).length
  return { done, total: 9 }
}

/** El último resultado de matchmaking del usuario (lo genera MERGE por voz). */
export async function fetchLatestMatchResult(
  userId: string,
): Promise<{ result: MergieResult | null; created_at: string | null }> {
  const { data } = await supabase
    .from("match_requests")
    .select("result, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return { result: (data?.result as MergieResult) ?? null, created_at: data?.created_at ?? null }
}
