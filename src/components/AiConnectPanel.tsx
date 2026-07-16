// ──────────────────────────────────────────────────────────────────────────────
// CONEXIÓN IA — panel lateral de Explorar (función estrella).
//
// El usuario describe a quién busca (o el proyecto al que quiere unirse) y la
// IA (Gemini Flash vía Edge Function) devuelve una lista de personas reales de
// la comunidad. Clic en una persona → chat directo con ella.
// Acento NARANJA sobre la estética Linear oscura del resto de la web.
// ──────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { MatchProfile } from "../lib/matchmaking"
import {
  searchConnections, isFormValid,
  type AiSearchForm, type AiSearchResult, type AiMatch,
} from "../lib/aiConnect"

const ORANGE = "#f97316"
const ORANGE_SOFT = "#fdba74"

export default function AiConnectPanel({ me, candidates, disabled, locked, onLocked }: {
  me: MatchProfile | null
  candidates: MatchProfile[]
  /** true mientras los perfiles aún están cargando */
  disabled: boolean
  /** true si el perfil propio está incompleto (no puede abrir chats) */
  locked: boolean
  onLocked: () => void
}) {
  const navigate = useNavigate()
  const [form, setForm] = useState<AiSearchForm>({
    joinProject: false, projectType: "", roles: "", personInfo: "",
  })
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<AiSearchResult | null>(null)

  const valid = isFormValid(form)

  const handleSearch = async () => {
    if (!valid || searching || disabled) return
    setSearching(true)
    setResult(null)
    try {
      setResult(await searchConnections(me, candidates, form))
    } finally {
      setSearching(false)
    }
  }

  const openChat = (id: string) => {
    if (locked) onLocked()
    else navigate(`/chat/${id}`)
  }

  return (
    <div
      className="rounded-2xl p-5 overflow-hidden relative"
      style={{
        background: "linear-gradient(180deg, rgba(249,115,22,0.07), rgba(249,115,22,0.015) 40%), var(--surface)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        backdropFilter: "blur(20px) saturate(1.3)",
        border: "1px solid rgba(249,115,22,0.28)",
        boxShadow: "0 0 0 1px rgba(249,115,22,0.08), 0 8px 30px rgba(249,115,22,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <style>{`
        @keyframes ai-result-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ai-pulse { 0%, 100% { opacity: 0.45 } 50% { opacity: 1 } }
        .ai-field:focus {
          border-color: rgba(249,115,22,0.65) !important;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.16) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ai-result-card { animation: none !important; }
        }
      `}</style>

      {/* Cabecera */}
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{
            background: "radial-gradient(circle at 50% 30%, rgba(249,115,22,0.32), rgba(249,115,22,0.10))",
            border: "1px solid rgba(249,115,22,0.40)", color: ORANGE_SOFT,
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.9z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-white leading-tight">Conexión IA</h2>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(249,115,22,0.14)", color: ORANGE_SOFT, border: "1px solid rgba(249,115,22,0.35)" }}>
              Gemini Flash
            </span>
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-dim)" }}>
            Describe a quién necesitas y la IA buscará en los perfiles reales.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="mt-4 space-y-3">
        {/* Toggle: unirme a un proyecto existente */}
        <button
          type="button"
          role="switch"
          aria-checked={form.joinProject}
          onClick={() => setForm(f => ({ ...f, joinProject: !f.joinProject }))}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-left"
          style={{
            background: form.joinProject ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${form.joinProject ? "rgba(249,115,22,0.35)" : "var(--border)"}`,
          }}
        >
          <span className="text-[12.5px] font-medium" style={{ color: form.joinProject ? ORANGE_SOFT : "var(--text-dim)" }}>
            Quiero unirme a un proyecto existente
          </span>
          <span className="relative w-9 h-5 rounded-full shrink-0 transition-colors"
            style={{ background: form.joinProject ? ORANGE : "rgba(255,255,255,0.12)" }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: form.joinProject ? 18 : 2 }} />
          </span>
        </button>

        {form.joinProject ? (
          <>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>
                ¿A qué tipo de proyecto?
              </label>
              <input
                value={form.projectType}
                onChange={e => setForm(f => ({ ...f, projectType: e.target.value }))}
                placeholder="SaaS de educación, ecommerce, app móvil…"
                className="ai-field field-input w-full px-3 py-2 rounded-lg text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>
                ¿Qué funciones podrías desempeñar?
              </label>
              <textarea
                value={form.roles}
                onChange={e => setForm(f => ({ ...f, roles: e.target.value }))}
                placeholder="Desarrollo frontend, marketing digital, ventas B2B…"
                rows={2}
                className="ai-field field-input w-full px-3 py-2 rounded-lg text-[13px] resize-none"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>
              Describe a la persona que buscas
            </label>
            <textarea
              value={form.personInfo}
              onChange={e => setForm(f => ({ ...f, personInfo: e.target.value }))}
              placeholder="Busco un cofundador técnico con experiencia en IA, o alguien de marketing que sepa de redes…"
              rows={3}
              className="ai-field field-input w-full px-3 py-2 rounded-lg text-[13px] resize-none"
            />
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={!valid || searching || disabled}
          className="w-full px-4 py-2.5 rounded-lg text-[13px] font-semibold transition inline-flex items-center justify-center gap-2"
          style={{
            background: valid && !searching && !disabled
              ? `linear-gradient(180deg, ${ORANGE}, #ea580c)`
              : "rgba(255,255,255,0.05)",
            color: valid && !searching && !disabled ? "#fff" : "var(--text-dimmer)",
            border: "1px solid " + (valid && !searching && !disabled ? "rgba(255,255,255,0.12)" : "var(--border)"),
            cursor: valid && !searching && !disabled ? "pointer" : "not-allowed",
          }}
          onMouseEnter={e => { if (valid && !searching && !disabled) e.currentTarget.style.filter = "brightness(1.1)" }}
          onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
        >
          {searching ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
              Buscando conexiones…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              Buscar con IA
            </>
          )}
        </button>
      </div>

      {/* Resultados */}
      {searching && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[58px] rounded-lg"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                animation: `ai-pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
              }} />
          ))}
        </div>
      )}

      {!searching && result && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>
              {result.matches.length > 0
                ? `${result.matches.length} ${result.matches.length === 1 ? "persona encontrada" : "personas encontradas"}`
                : "Sin resultados"}
            </span>
            {result.source === "local" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                title={
                  result.fallbackReason === "rate_limited"
                    ? "IA saturada (límite de Gemini alcanzado); usando búsqueda local"
                    : result.fallbackReason === "no_api_key"
                      ? "IA no configurada; usando búsqueda local"
                      : result.fallbackReason === "timeout"
                        ? "La IA tardó demasiado; usando búsqueda local"
                        : "La IA no está disponible ahora mismo; resultados del algoritmo local"
                }
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dimmer)", border: "1px solid var(--border)" }}>
                modo local
              </span>
            )}
          </div>

          {result.matches.length === 0 ? (
            <p className="text-[12px] leading-relaxed py-3 px-3 rounded-lg border border-dashed"
              style={{ color: "var(--text-dim)", borderColor: "rgba(249,115,22,0.25)" }}>
              Nadie encaja con esa búsqueda todavía. Prueba a describirlo de otra forma o con menos requisitos.
            </p>
          ) : (
            <div className="space-y-2">
              {result.matches.map((m, i) => (
                <AiResultCard key={m.id} match={m} index={i}
                  profile={candidates.find(c => c.id === m.id)}
                  onClick={() => openChat(m.id)} />
              ))}
              <p className="text-[10.5px] mt-1" style={{ color: "var(--text-dimmer)" }}>
                Pulsa en una persona para abrir un chat con ella.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AiResultCard({ match, profile, index, onClick }: {
  match: AiMatch
  profile?: MatchProfile
  index: number
  onClick: () => void
}) {
  const name = profile?.nombre || "Fundador"
  const initial = name.trim()[0]?.toUpperCase() || "?"

  return (
    <button
      onClick={onClick}
      className="ai-result-card w-full text-left rounded-lg p-3 cursor-pointer transition"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        animation: `ai-result-in 0.3s ease-out both`,
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(249,115,22,0.07)"
        e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)"
        e.currentTarget.style.borderColor = "var(--border)"
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
          style={{
            background: "rgba(249,115,22,0.10)",
            border: "1px solid rgba(249,115,22,0.30)",
            color: ORANGE_SOFT,
          }}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white truncate">{name}</span>
            {match.fit && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md truncate shrink-0"
                style={{ background: "rgba(249,115,22,0.12)", color: ORANGE_SOFT, border: "1px solid rgba(249,115,22,0.25)" }}>
                {match.fit}
              </span>
            )}
          </div>
          <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "var(--text-dim)" }}>
            {match.reason}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-bold leading-none" style={{ color: ORANGE }}>
            {match.score}<span className="text-[10px] font-medium">%</span>
          </div>
          <svg className="ml-auto mt-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-dimmer)" }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
      </div>
    </button>
  )
}
