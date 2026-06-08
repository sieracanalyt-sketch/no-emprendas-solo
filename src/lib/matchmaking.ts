// ──────────────────────────────────────────────────────────────────────────────
// NES CONNECT — algoritmo de compatibilidad con filtro anti-ghosting.
//
// Cruza el perfil de dos fundadores (roles buscados, habilidades/bio, proyecto)
// para obtener un % de match estable. Penaliza la inactividad: quien no registra
// actividad en 7+ días ve su puntuación caer un 50% y baja en el feed, por muy
// compatible que sea técnicamente. Solo arriba los fundadores activos.
// ──────────────────────────────────────────────────────────────────────────────

export type MatchProfile = {
  id: string
  nombre?: string | null
  biografia?: string | null
  proyecto?: string | null
  buscando?: string[] | null   // roles que busca
  role?: string | null         // rol del usuario (workflow_roles)
  last_login?: string | null   // actividad (anti-ghosting)
  created_at?: string | null   // fallback de actividad
}

export type MatchFactor = {
  label: string
  pts: number   // puntos obtenidos en este factor
  max: number   // puntos máximos posibles
}

export type MatchResult = {
  score: number          // 0–100 (ya penalizado)
  rawScore: number       // 0–100 sin penalización
  inactive: boolean      // true si 7+ días sin actividad
  daysInactive: number
  reasons: string[]      // motivos legibles del match
  breakdown: MatchFactor[] // desglose por factor para el popover
  baseline: number         // suelo mínimo aplicado
}

export const INACTIVITY_DAYS = 7
export const INACTIVITY_PENALTY = 0.5 // −50 %
const STRONG_MATCH = 80

const STOPWORDS = new Set([
  "de","la","el","los","las","un","una","unos","unas","y","o","u","a","en","con",
  "por","para","del","al","que","se","su","sus","mi","tu","es","soy","busco","app",
  "the","and","for","with","to","of","in","on","my","i","we","app","startup","proyecto",
])

function tokenize(...parts: (string | null | undefined)[]): Set<string> {
  const text = parts.filter(Boolean).join(" ").toLowerCase()
  const words = text
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // sin tildes
    .replace(/[^a-z0-9\s/]/g, " ")
    .split(/[\s/]+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
  return new Set(words)
}

function overlap(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = []
  for (const w of a) if (b.has(w)) out.push(w)
  return out
}

// Hash estable de un par de ids → jitter determinista [0,1).
// Evita que perfiles con datos escasos queden todos en 0 % y mantiene el orden
// estable entre recargas.
function pairJitter(a: string, b: string): number {
  const s = a < b ? a + b : b + a
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return Infinity
  return (Date.now() - t) / 86_400_000
}

/** Compatibilidad de `other` respecto a `me`. */
export function computeMatch(me: MatchProfile, other: MatchProfile): MatchResult {
  const reasons: string[] = []
  let score = 0

  const myBuscando = (me.buscando ?? []).map(s => s.toLowerCase())
  const otherBuscando = (other.buscando ?? []).map(s => s.toLowerCase())
  const myTokens = tokenize(me.biografia, me.proyecto, me.role, ...(me.buscando ?? []))
  const otherTokens = tokenize(other.biografia, other.proyecto, other.role, ...(other.buscando ?? []))

  // 1) Complementariedad de roles (lo que YO busco ↔ lo que ÉL es) ── 40 pts
  const otherRoleTokens = tokenize(other.role, other.proyecto, other.biografia)
  let roleHit = false
  for (const want of myBuscando) {
    const wt = tokenize(want)
    if (overlap(wt, otherRoleTokens).length > 0) { roleHit = true; break }
  }
  if (roleHit) {
    score += 28
    reasons.push("Encaja con lo que buscas")
  }
  // …y lo que ÉL busca ↔ lo que YO soy (match mutuo)
  const myRoleTokens = tokenize(me.role, me.proyecto, me.biografia)
  let mutual = false
  for (const want of otherBuscando) {
    const wt = tokenize(want)
    if (overlap(wt, myRoleTokens).length > 0) { mutual = true; break }
  }
  if (mutual) {
    score += 12
    reasons.push("También te busca a ti")
  }

  // 2) Habilidades / intereses en común ── hasta 30 pts
  const common = overlap(myTokens, otherTokens)
  if (common.length > 0) {
    score += Math.min(30, common.length * 10)
    const sample = common.slice(0, 2).join(", ")
    reasons.push(common.length === 1 ? `Interés común: ${sample}` : `${common.length} intereses en común`)
  }

  // 3) Tipo de proyecto afín ── hasta 18 pts
  const projOverlap = overlap(tokenize(me.proyecto), tokenize(other.proyecto))
  if (projOverlap.length > 0) {
    score += Math.min(18, projOverlap.length * 9)
    reasons.push(`Proyecto afín: ${projOverlap[0]}`)
  }

  // 4) Suelo determinista para perfiles escasos (estable entre recargas) ── 12–30
  const baseline = 12 + Math.round(pairJitter(me.id, other.id) * 18)
  const preBaseline = score
  score = Math.max(score, baseline)
  if (reasons.length === 0) reasons.push("Perfil compatible")

  const rolePts = roleHit ? 28 : 0
  const mutualPts = mutual ? 12 : 0
  const commonPts = Math.min(30, common.length * 10)
  const projPts = Math.min(18, projOverlap.length * 9)

  let raw = Math.max(0, Math.min(100, Math.round(score)))

  // ── Filtro anti-ghosting ────────────────────────────────────────────────
  const days = daysSince(other.last_login ?? other.created_at)
  const inactive = days >= INACTIVITY_DAYS
  const finalScore = inactive ? Math.round(raw * INACTIVITY_PENALTY) : raw

  const breakdown: MatchFactor[] = [
    { label: "Encaja con lo que buscas", pts: rolePts, max: 28 },
    { label: "También te busca a ti", pts: mutualPts, max: 12 },
    { label: "Intereses en común", pts: commonPts, max: 30 },
    { label: "Proyecto afín", pts: projPts, max: 18 },
    { label: "Base mínima garantizada", pts: preBaseline < baseline ? baseline - preBaseline : 0, max: 18 },
  ]

  return {
    score: finalScore,
    rawScore: raw,
    inactive,
    daysInactive: Number.isFinite(days) ? Math.floor(days) : 999,
    reasons: reasons.slice(0, 3),
    breakdown,
    baseline,
  }
}

export function isStrongMatch(score: number): boolean {
  return score >= STRONG_MATCH
}
