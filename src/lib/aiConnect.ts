// ──────────────────────────────────────────────────────────────────────────────
// CONEXIÓN IA — cliente de la búsqueda inteligente de personas (NES Connect).
//
// Llama a la Edge Function `ai-connect` (Gemini Flash, clave en el servidor).
// Si la IA no está disponible (sin GEMINI_API_KEY, función caída o sin red),
// degrada al algoritmo local basado en tokens para que la herramienta siga
// funcionando siempre.
// ──────────────────────────────────────────────────────────────────────────────
import { supabase } from "../supabase"
import { tokenize, overlap, type MatchProfile } from "./matchmaking"

export type AiSearchForm = {
  /** true = quiere unirse a un proyecto existente */
  joinProject: boolean
  /** tipo de proyecto al que quiere unirse (modo proyecto) */
  projectType: string
  /** funciones que podría desempeñar en ese equipo (modo proyecto) */
  roles: string
  /** descripción de la persona que busca (modo persona) */
  personInfo: string
}

export type AiMatch = {
  id: string
  score: number
  reason: string
  fit?: string
}

export type AiSearchResult = {
  matches: AiMatch[]
  /** "ai" = Gemini Flash · "local" = fallback sin IA */
  source: "ai" | "local"
}

const MAX_RESULTS = 6
/** Tiempo máximo de espera a la Edge Function antes de caer al modo local. */
const AI_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ai-connect timeout")), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

export function isFormValid(form: AiSearchForm): boolean {
  return form.joinProject
    ? (form.projectType.trim() + form.roles.trim()).length > 0
    : form.personInfo.trim().length > 0
}

/** Busca conexiones con Gemini Flash; si falla, usa el algoritmo local. */
export async function searchConnections(
  me: MatchProfile | null,
  candidates: MatchProfile[],
  form: AiSearchForm,
): Promise<AiSearchResult> {
  const compact = candidates.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    biografia: c.biografia,
    proyecto: c.proyecto,
    buscando: c.buscando,
    role: c.role,
    project_status: c.project_status,
    streak_days: c.streak_days,
  }))

  try {
    // withTimeout: si la función (o el lock de auth del SDK) se queda colgada,
    // degradamos al algoritmo local en vez de dejar el spinner eterno.
    const { data, error } = await withTimeout(supabase.functions.invoke("ai-connect", {
      body: {
        me: me && {
          id: me.id,
          nombre: me.nombre,
          biografia: me.biografia,
          proyecto: me.proyecto,
          buscando: me.buscando,
          role: me.role,
        },
        search: {
          joinProject: form.joinProject,
          projectType: form.projectType.trim(),
          roles: form.roles.trim(),
          personInfo: form.personInfo.trim(),
        },
        candidates: compact,
      },
    }), AI_TIMEOUT_MS)
    if (!error && data && Array.isArray(data.matches)) {
      return { matches: data.matches as AiMatch[], source: "ai" }
    }
  } catch {
    // sin red o función no desplegada → fallback local
  }
  return { matches: localSearch(me, candidates, form), source: "local" }
}

// ── Fallback local (sin IA) ──────────────────────────────────────────────────
function localSearch(
  me: MatchProfile | null,
  candidates: MatchProfile[],
  form: AiSearchForm,
): AiMatch[] {
  const queryText = form.joinProject
    ? `${form.projectType} ${form.roles}`
    : form.personInfo
  const qTokens = tokenize(queryText)
  // En modo proyecto, lo que YO ofrezco debería encajar con lo que el candidato busca
  const offerTokens = form.joinProject
    ? tokenize(form.roles, me?.role, me?.biografia)
    : new Set<string>()

  const scored: AiMatch[] = []
  for (const c of candidates) {
    const cTokens = tokenize(c.biografia, c.proyecto, c.role, ...(c.buscando ?? []))
    const hits = overlap(qTokens, cTokens)
    let score = Math.min(70, hits.length * 14)
    let offerHits: string[] = []

    if (form.joinProject) {
      offerHits = overlap(offerTokens, tokenize(...(c.buscando ?? [])))
      score += Math.min(24, offerHits.length * 12)
      // bonus si tiene proyecto definido al que unirse
      if ((c.proyecto ?? "").trim().length > 0) score += 6
    }

    if (score < 20) continue
    const reason =
      offerHits.length > 0
        ? `Su proyecto busca lo que ofreces: ${offerHits.slice(0, 2).join(", ")}`
        : hits.length > 0
          ? `Coincidencias con tu búsqueda: ${hits.slice(0, 3).join(", ")}`
          : "Tiene un proyecto activo al que podrías unirte"
    scored.push({
      id: c.id,
      score: Math.min(100, score),
      reason,
      fit: c.role ?? undefined,
    })
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
}
