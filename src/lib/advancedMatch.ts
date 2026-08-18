// ──────────────────────────────────────────────────────────────────────────────
// MATCHMAKING AVANZADO — la capa premium de NES Connect.
//
// Rediseñado según el documento de investigación del fundador (jul 2026):
// 9 campos CONDUCTUALES cortos (nada de tests de personalidad — Sackett 2022:
// las muestras conductuales predicen mejor que los tests de rasgos). Lo que
// predice equipos que duran es la ALINEACIÓN (ambición, horas reales, ritmo,
// fiabilidad) + complementariedad funcional de roles, no la similitud.
//
// SEGUNDA OLA (doc "Cómo hacer que Mergie prediga, puntúe y verifique matches",
// jul 2026) — 5 campos imprescindibles + 3 opcionales más, priorizados por poder
// de señal empírica:
//   · Escala/exit esperado (First Round) — la desalineación de visión es fisura.
//   · Compromiso real: horas ahora, horas en 6 meses y runway personal.
//   · Estilo de gestión de conflicto SITUACIONAL (Gottman: reparar > no discutir).
//   · Áreas de responsabilidad + pasión (AoR de First Round) — complementariedad
//     real medida por cobertura, no por etiquetas.
//   · Filosofía de equity y control vs. wealth (Hellmann & Wasserman 2016: el
//     73% reparte en el primer mes y es la tensión peor gestionada).
// Opcionales (más fricción o más sensibles, desbloqueables): mini Big Five,
// historial de colaboración previa y cultura ideal.
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

// ── segunda ola: tipos nuevos ────────────────────────────────────────────────
export type ExitIdeal = "no_vender" | "salida_rapida" | "construir_y_vender" | "ipo"
export type Runway = "0" | "lt3" | "3_6" | "6_12" | "gt12"
export type EquitySplit = "igual_siempre" | "segun_aporte" | "fundador_mayoria" | "no_lo_he_pensado"
export type Colaboracion = "nunca" | "bien" | "mal" | "mixto"

/** Áreas de responsabilidad (AoR de First Round): cobertura real, no etiquetas. */
export type Area =
  | "producto" | "ingenieria" | "diseno" | "ventas" | "marketing"
  | "operaciones" | "estrategia" | "fundraising" | "liderazgo" | "legal_admin"

/** Auto-valoración por área: nivel 1-10 + si además le apasiona. */
export type AreaRating = { nivel: number; pasion: boolean }

/** Mini Big Five (~10 ítems agregados a 5 escalas 1-5). Señal, nunca veredicto. */
export type BigFive = {
  apertura: number | null
  responsabilidad: number | null
  extraversion: number | null
  amabilidad: number | null
  estabilidad: number | null
}

export const EMPTY_BIG_FIVE: BigFive = {
  apertura: null, responsabilidad: null, extraversion: null, amabilidad: null, estabilidad: null,
}

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

  // ── imprescindibles (segunda ola) ──
  exit_ideal: ExitIdeal | null
  horas_6m: Horas | null            // compromiso proyectado, no solo el de hoy
  runway_meses: Runway | null       // meses que aguanta sin salario
  conflicto_reparacion: string | null  // situacional (máx. 400)
  areas: Partial<Record<Area, AreaRating>>
  equity_split: EquitySplit | null
  king_o_rich: number | null        // 1 control (king) … 4 dinero (rich)

  // ── opcionales (desbloqueables) ──
  big_five: BigFive
  colaboracion_previa: Colaboracion | null
  colaboracion_detalle: string | null  // máx. 300
  cultura_ideal: string | null         // máx. 200

  // ── ponderación declarada por el usuario (estilo OkCupid), máx. 2 ──
  pesos_usuario: CategoriaScore[]
}

export const EMPTY_PROFILE: MatchProfileFields = {
  rol_buscado: null, fuerte_en: [], necesita: [], ambicion: null, horas: null,
  fiabilidad: null, conflicto: null, ritmo_plan: null, ritmo_decision: null,
  importa: null, temas: [],
  exit_ideal: null, horas_6m: null, runway_meses: null, conflicto_reparacion: null,
  areas: {}, equity_split: null, king_o_rich: null,
  big_five: { ...EMPTY_BIG_FIVE }, colaboracion_previa: null,
  colaboracion_detalle: null, cultura_ideal: null,
  pesos_usuario: [],
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

// ── segunda ola: catálogos ───────────────────────────────────────────────────

export const EXIT_OPTS: { value: ExitIdeal; label: string; hint: string }[] = [
  { value: "no_vender", label: "No vender nunca", hint: "Vivir de ello, a mi ritmo, sin jefes ni inversores" },
  { value: "salida_rapida", label: "Vender pronto", hint: "1-2 años y una cifra que me cambie la vida" },
  { value: "construir_y_vender", label: "Construir y vender grande", hint: "5-10 años, con inversión, y una salida seria" },
  { value: "ipo", label: "Ir a por todas", hint: "10+ años, salir a bolsa, no vender" },
]

export const RUNWAY_OPTS: { value: Runway; label: string; hint: string }[] = [
  { value: "0", label: "Nada", hint: "Necesito ingresar desde el primer mes" },
  { value: "lt3", label: "< 3 meses", hint: "Aguanto poco sin cobrar" },
  { value: "3_6", label: "3-6 meses", hint: "Tengo colchón para medio año" },
  { value: "6_12", label: "6-12 meses", hint: "Puedo aguantar casi un año" },
  { value: "gt12", label: "+12 meses", hint: "El dinero no me condiciona por ahora" },
]

export const EQUITY_OPTS: { value: EquitySplit; label: string; hint: string }[] = [
  { value: "igual_siempre", label: "Siempre 50/50", hint: "Partes iguales pase lo que pase" },
  { value: "segun_aporte", label: "Según lo que aporte cada uno", hint: "Tiempo, dinero, idea y riesgo pesan distinto" },
  { value: "fundador_mayoria", label: "Quien lidera, mayoría", hint: "El que empuja el proyecto se queda más" },
  { value: "no_lo_he_pensado", label: "No lo he pensado aún", hint: "Sé que hay que hablarlo" },
]

export const COLABORACION_OPTS: { value: Colaboracion; label: string }[] = [
  { value: "nunca", label: "Nunca he montado nada con alguien" },
  { value: "bien", label: "Sí, y salió bien" },
  { value: "mal", label: "Sí, y acabó mal" },
  { value: "mixto", label: "Sí, con de todo" },
]

export const AREAS: { value: Area; label: string }[] = [
  { value: "producto", label: "Producto" },
  { value: "ingenieria", label: "Ingeniería / programar" },
  { value: "diseno", label: "Diseño" },
  { value: "ventas", label: "Ventas" },
  { value: "marketing", label: "Marketing" },
  { value: "operaciones", label: "Operaciones" },
  { value: "estrategia", label: "Estrategia" },
  { value: "fundraising", label: "Fundraising" },
  { value: "liderazgo", label: "Liderar gente" },
  { value: "legal_admin", label: "Legal y papeleo" },
]

export const BIG_FIVE_SCALES: { key: keyof BigFive; left: string; right: string }[] = [
  { key: "apertura", left: "Prefiero lo que ya sé que funciona", right: "Me lanzo a probar cosas nuevas" },
  { key: "responsabilidad", left: "Voy improvisando y a veces se me pasan cosas", right: "Si digo que lo hago, está hecho" },
  { key: "extraversion", left: "Trabajo mejor en silencio y solo", right: "Me cargo de energía hablando con gente" },
  { key: "amabilidad", left: "Voy de frente aunque escueza", right: "Cuido mucho cómo se siente el otro" },
  { key: "estabilidad", left: "La presión me afecta bastante", right: "Cuanto peor se pone, más frío estoy" },
]

// ── Bloque 2: rúbrica explicable 0-100 ───────────────────────────────────────
// Nunca un número-caja-negra: 5 categorías con peso, sub-score y justificación
// que cita evidencia literal del perfil (feature attribution, estilo XAI).

export type CategoriaScore =
  | "vision_valores" | "complementariedad" | "compromiso" | "riesgo_conflicto" | "personalidad"

export const RUBRICA: { key: CategoriaScore; label: string; peso: number; evalua: string }[] = [
  { key: "vision_valores",    label: "Alineación de visión y valores", peso: 25, evalua: "Escala y salida esperada, motivación, valores" },
  { key: "complementariedad", label: "Complementariedad de roles",     peso: 20, evalua: "Cobertura de áreas frente a duplicación" },
  { key: "compromiso",        label: "Compatibilidad de compromiso",   peso: 20, evalua: "Horas reales, runway, urgencia" },
  { key: "riesgo_conflicto",  label: "Riesgo de conflicto",            peso: 20, evalua: "Cómo discutís y cómo reparáis (nota invertida: menos riesgo, más puntos)" },
  { key: "personalidad",      label: "Diversidad de personalidad",     peso: 15, evalua: "Señal complementaria, nunca un veredicto" },
]

export const CATEGORIA_LABEL: Record<CategoriaScore, string> =
  Object.fromEntries(RUBRICA.map((r) => [r.key, r.label])) as Record<CategoriaScore, string>

/** Tope de categorías que el usuario puede marcar como "muy importante para mí". */
export const MAX_PESOS_USUARIO = 2

// ── resultado del motor Mergie (espejo de src/jarvis/contract.ts) ────────────

/** Un sub-score explicable: nota + por qué + la evidencia literal que la sostiene. */
export type SubScore = {
  categoria: CategoriaScore
  score: number              // 0-100
  peso: number               // % aplicado (puede diferir de RUBRICA si el usuario re-pondera)
  justificacion: string
  evidencia?: string[]       // citas literales del perfil de ambos
}

export type MergieMatch = {
  posicion: number
  id_perfil: string
  nombre: string
  porque_encaja: string
  punto_fuerte: string
  a_hablar_desde_el_principio: string | null
  primer_paso: string
  // ── scoring explicable (Bloque 2) ──
  score_global?: number | null
  sub_scores?: SubScore[]
  red_flags?: string[]
  green_flags?: string[]
  /** Las 3 conversaciones difíciles a tener antes de comprometerse. */
  conversaciones_pendientes?: string[]
  /** Si un red flag ha capado la nota global en vez de diluirse en la media. */
  capado_por_red_flag?: boolean
}

export type MergieResult = {
  generated?: string | null
  resumen?: string | null
  matches: MergieMatch[]
  nota_honesta?: string | null
  gaps?: { total_members?: number; premium_members?: number; advanced_profiles?: number }
  /** Categorías que el usuario marcó como prioritarias en este cruce. */
  pesos_usuario?: CategoriaScore[]
}

// ── acceso a datos ───────────────────────────────────────────────────────────

// Un único literal, sin concatenar: supabase-js infiere el tipo de la fila a
// partir de la cadena de `select` y una concatenación la degrada a `string`.
const FIELDS = "rol_buscado, fuerte_en, necesita, ambicion, horas, fiabilidad, conflicto, ritmo_plan, ritmo_decision, importa, temas, exit_ideal, horas_6m, runway_meses, conflicto_reparacion, areas, equity_split, king_o_rich, big_five, colaboracion_previa, colaboracion_detalle, cultura_ideal, pesos_usuario"

// ── validación en la frontera con la base ────────────────────────────────────
// En Postgres estas columnas son `text` con CHECK, no enums: la base garantiza
// el dominio, pero el tipo estrecho de TypeScript hay que ganárselo al leer.
// Los catálogos de arriba son la fuente única, así que un valor huérfano
// (constraint cambiada, fila vieja) se descarta en vez de colarse mal tipado.

const valuesOf = <T extends string>(opts: readonly { value: T }[]): readonly T[] =>
  opts.map((o) => o.value)

function oneOf<T extends string>(allowed: readonly T[], v: string | null | undefined): T | null {
  return v != null && (allowed as readonly string[]).includes(v) ? (v as T) : null
}

function manyOf<T extends string>(
  allowed: readonly T[],
  v: readonly string[] | null | undefined,
): T[] {
  return (v ?? []).filter((x): x is T => (allowed as readonly string[]).includes(x))
}

const ROL_VALUES = valuesOf(ROLES)
const FORTALEZA_VALUES = valuesOf(FORTALEZAS)
const HORAS_VALUES = valuesOf(HORAS_OPTS)
const FIABILIDAD_VALUES = valuesOf(FIABILIDAD_OPTS)
const CONFLICTO_VALUES = valuesOf(CONFLICTO_OPTS)
const TEMA_VALUES = valuesOf(TEMAS_OPTS)
const EXIT_VALUES = valuesOf(EXIT_OPTS)
const RUNWAY_VALUES = valuesOf(RUNWAY_OPTS)
const EQUITY_VALUES = valuesOf(EQUITY_OPTS)
const COLABORACION_VALUES = valuesOf(COLABORACION_OPTS)
const CATEGORIA_VALUES: readonly CategoriaScore[] = RUBRICA.map((r) => r.key)

export async function loadMatchProfile(userId: string): Promise<MatchProfileFields> {
  const { data } = await supabase
    .from("match_profiles")
    .select(FIELDS)
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return { ...EMPTY_PROFILE }
  return {
    rol_buscado: oneOf(ROL_VALUES, data.rol_buscado),
    fuerte_en: manyOf(FORTALEZA_VALUES, data.fuerte_en),
    necesita: manyOf(FORTALEZA_VALUES, data.necesita),
    ambicion: data.ambicion ?? null,
    horas: oneOf(HORAS_VALUES, data.horas),
    fiabilidad: oneOf(FIABILIDAD_VALUES, data.fiabilidad),
    conflicto: oneOf(CONFLICTO_VALUES, data.conflicto),
    ritmo_plan: data.ritmo_plan ?? null,
    ritmo_decision: data.ritmo_decision ?? null,
    importa: data.importa ?? null,
    temas: manyOf(TEMA_VALUES, data.temas),
    exit_ideal: oneOf(EXIT_VALUES, data.exit_ideal),
    horas_6m: oneOf(HORAS_VALUES, data.horas_6m),
    runway_meses: oneOf(RUNWAY_VALUES, data.runway_meses),
    conflicto_reparacion: data.conflicto_reparacion ?? null,
    areas: (data.areas as MatchProfileFields["areas"]) ?? {},
    equity_split: oneOf(EQUITY_VALUES, data.equity_split),
    king_o_rich: data.king_o_rich ?? null,
    big_five: { ...EMPTY_BIG_FIVE, ...((data.big_five as Partial<BigFive> | null) ?? {}) },
    colaboracion_previa: oneOf(COLABORACION_VALUES, data.colaboracion_previa),
    colaboracion_detalle: data.colaboracion_detalle ?? null,
    cultura_ideal: data.cultura_ideal ?? null,
    pesos_usuario: manyOf(CATEGORIA_VALUES, data.pesos_usuario),
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

/**
 * Completitud del bloque OBLIGATORIO: las 9 preguntas conductuales originales +
 * las 5 imprescindibles de la segunda ola (máxima señal predictiva, baja
 * fricción). Si la finalización de onboarding cayera por debajo del ~70%, la
 * recomendación del doc es mover un campo obligatorio a opcional.
 */
export function profileCompletion(f: MatchProfileFields): { done: number; total: number } {
  const done = [
    f.rol_buscado, f.fuerte_en.length > 0, f.necesita.length > 0, f.ambicion,
    f.horas, f.fiabilidad, f.conflicto, f.ritmo_plan != null && f.ritmo_decision != null,
    (f.importa ?? "").trim() !== "" || f.temas.length > 0,
    // imprescindibles nuevos
    f.exit_ideal,
    f.horas_6m != null && f.runway_meses != null,
    (f.conflicto_reparacion ?? "").trim() !== "",
    Object.keys(f.areas).length > 0,
    f.equity_split != null && f.king_o_rich != null,
  ].filter(Boolean).length
  return { done, total: 14 }
}

/** Completitud del bloque OPCIONAL ("completa tu perfil para mejores matches"). */
export function extraCompletion(f: MatchProfileFields): { done: number; total: number } {
  const done = [
    Object.values(f.big_five).some((v) => v != null),
    f.colaboracion_previa != null,
    (f.cultura_ideal ?? "").trim() !== "",
  ].filter(Boolean).length
  return { done, total: 3 }
}

/**
 * Ponderación efectiva estilo OkCupid: las categorías que el usuario marcó como
 * "muy importante para mí" doblan su peso y el resto se re-normaliza a 100. Se
 * expone para que la interfaz pueda mostrar cómo cambia el score al re-ponderar.
 */
export function effectiveWeights(pesos: CategoriaScore[]): Record<CategoriaScore, number> {
  const raw = RUBRICA.map((r) => ({ key: r.key, peso: r.peso * (pesos.includes(r.key) ? 2 : 1) }))
  const total = raw.reduce((s, r) => s + r.peso, 0)
  return Object.fromEntries(
    raw.map((r) => [r.key, Math.round((r.peso / total) * 100)]),
  ) as Record<CategoriaScore, number>
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
