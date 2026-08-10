import { useEffect, useState } from "react"
import {
  ROLES, FORTALEZAS, AMBICION, HORAS_OPTS, FIABILIDAD_OPTS, CONFLICTO_OPTS, TEMAS_OPTS,
  EXIT_OPTS, RUNWAY_OPTS, EQUITY_OPTS, COLABORACION_OPTS, AREAS, BIG_FIVE_SCALES,
  RUBRICA, MAX_PESOS_USUARIO, effectiveWeights,
  loadMatchProfile, saveMatchProfile, profileCompletion, extraCompletion, EMPTY_PROFILE,
  type MatchProfileFields, type Fortaleza, type Tema, type Area, type AreaRating,
  type BigFive, type CategoriaScore,
} from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Perfil de Matchmaking Avanzado (premium). Lenguaje de la calle, cero jerga
// psicológica. Guardar está protegido por RLS: solo premium/trial/admin.
//
// Estructura según el doc de investigación (jul 2026):
//   · 14 preguntas obligatorias — 9 conductuales originales + 5 imprescindibles
//     de máxima señal (exit, compromiso real, conflicto situacional, áreas de
//     responsabilidad, equity/control).
//   · 3 opcionales desbloqueables — se piden DESPUÉS, para no disparar el
//     abandono de onboarding (mini Big Five, colaboración previa, cultura).
//   · Ponderación declarada por el usuario (estilo OkCupid) para el score.
// ──────────────────────────────────────────────────────────────────────────────

export default function AdvancedMatchProfile({ userId }: { userId: string }) {
  const [f, setF] = useState<MatchProfileFields>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [showExtra, setShowExtra] = useState(false)

  useEffect(() => {
    let alive = true
    loadMatchProfile(userId).then((p) => {
      if (!alive) return
      setF(p)
      setLoading(false)
    })
    return () => { alive = false }
  }, [userId])

  // multiselect con tope de 2 (evita el "todólogo" que no aporta señal)
  function toggleMax2(key: "fuerte_en" | "necesita", value: Fortaleza) {
    setF((prev) => {
      const cur = prev[key]
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].slice(-2)
      return { ...prev, [key]: next }
    })
  }

  function toggleTema(value: Tema) {
    setF((prev) => ({
      ...prev,
      temas: prev.temas.includes(value) ? prev.temas.filter((t) => t !== value) : [...prev.temas, value],
    }))
  }

  // AoR: nivel 1-10 por área. Nivel 0 = quitar el área del mapa de cobertura.
  function setAreaNivel(area: Area, nivel: number) {
    setF((prev) => {
      const areas = { ...prev.areas }
      if (nivel <= 0) delete areas[area]
      else areas[area] = { nivel, pasion: areas[area]?.pasion ?? false }
      return { ...prev, areas }
    })
  }

  function toggleAreaPasion(area: Area) {
    setF((prev) => {
      const cur = prev.areas[area]
      if (!cur) return prev
      return { ...prev, areas: { ...prev.areas, [area]: { ...cur, pasion: !cur.pasion } } }
    })
  }

  function setBigFive(key: keyof BigFive, v: number) {
    setF((prev) => ({ ...prev, big_five: { ...prev.big_five, [key]: v } }))
  }

  // Ponderación estilo OkCupid: máx. 2 categorías "muy importantes para mí".
  function togglePeso(key: CategoriaScore) {
    setF((prev) => {
      const cur = prev.pesos_usuario
      const next = cur.includes(key)
        ? cur.filter((k) => k !== key)
        : [...cur, key].slice(-MAX_PESOS_USUARIO)
      return { ...prev, pesos_usuario: next }
    })
  }

  async function handleSave() {
    if (saving) return
    setSaving(true); setMsg("")
    const payload: MatchProfileFields = {
      ...f,
      importa: f.importa?.trim().slice(0, 200) || null,
      conflicto_reparacion: f.conflicto_reparacion?.trim().slice(0, 400) || null,
      colaboracion_detalle: f.colaboracion_detalle?.trim().slice(0, 300) || null,
      cultura_ideal: f.cultura_ideal?.trim().slice(0, 200) || null,
    }
    const { error } = await saveMatchProfile(userId, payload)
    setSaving(false)
    setMsg(error ? "No se pudo guardar (¿tu cuenta es premium?)" : "Perfil guardado ✓")
    if (!error) setF(payload)
  }

  if (loading) return <div className="text-sm" style={{ color: "var(--text-dim)" }}>Cargando…</div>

  const prog = profileCompletion(f)
  const extra = extraCompletion(f)
  const pesos = effectiveWeights(f.pesos_usuario)

  return (
    <div className="space-y-7">
      {/* progreso */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${(prog.done / prog.total) * 100}%`, background: "var(--accent)" }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--text-dim)" }}>
          {prog.done}/{prog.total} respondidas
        </span>
      </div>

      {/* 1. qué buscas */}
      <Section title="¿Qué buscas ahora mismo?" n={1}>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Choice key={r.value} active={f.rol_buscado === r.value} title={r.label} hint={r.hint}
              onClick={() => setF({ ...f, rol_buscado: r.value })} />
          ))}
        </div>
      </Section>

      {/* 2. fuerte en */}
      <Section title="¿En qué eres tú fuerte de verdad?" n={2} hint="máx. 2">
        <ChipGrid options={FORTALEZAS} selected={f.fuerte_en}
          onToggle={(v) => toggleMax2("fuerte_en", v)} accent="#9a9d78" />
      </Section>

      {/* 3. necesitas */}
      <Section title="¿Qué necesitas que traiga la otra persona?" n={3} hint="máx. 2">
        <ChipGrid options={FORTALEZAS} selected={f.necesita}
          onToggle={(v) => toggleMax2("necesita", v)} accent="#c2542f" />
      </Section>

      {/* 4. ambición */}
      <Section title="¿Hasta dónde quieres llegar con esto?" n={4}>
        <div className="grid gap-2">
          {AMBICION.map((a) => (
            <Choice key={a.value} active={f.ambicion === a.value} title={a.label} hint=""
              onClick={() => setF({ ...f, ambicion: a.value })} wide />
          ))}
        </div>
      </Section>

      {/* 5. horas */}
      <Section title="¿Cuánto tiempo real le puedes meter por semana?" n={5}>
        <div className="flex flex-wrap gap-2">
          {HORAS_OPTS.map((h) => (
            <Choice key={h.value} active={f.horas === h.value} title={h.label} hint={h.hint}
              onClick={() => setF({ ...f, horas: h.value })} />
          ))}
        </div>
      </Section>

      {/* 6. fiabilidad */}
      <Section title="Cuando algo se rompe la noche antes de una entrega, ¿qué haces?" n={6}>
        <div className="grid gap-2">
          {FIABILIDAD_OPTS.map((o) => (
            <Choice key={o.value} active={f.fiabilidad === o.value} title={o.label} hint=""
              onClick={() => setF({ ...f, fiabilidad: o.value })} wide />
          ))}
        </div>
      </Section>

      {/* 7. conflicto */}
      <Section title="Cuando no estás de acuerdo con alguien de tu equipo, sueles…" n={7}>
        <div className="grid gap-2">
          {CONFLICTO_OPTS.map((o) => (
            <Choice key={o.value} active={f.conflicto === o.value} title={o.label} hint=""
              onClick={() => setF({ ...f, conflicto: o.value })} wide />
          ))}
        </div>
      </Section>

      {/* 8. ritmo (dos escalas de 4 puntos) */}
      <Section title="¿Cómo te gusta trabajar?" n={8}>
        <Scale left="Planificado, con listas y fechas" right="Improviso sobre la marcha"
          value={f.ritmo_plan} onChange={(v) => setF({ ...f, ritmo_plan: v })} />
        <div className="h-3" />
        <Scale left="Decido rápido y corrijo después" right="Lo pienso bien antes de decidir"
          value={f.ritmo_decision} onChange={(v) => setF({ ...f, ritmo_decision: v })} />
      </Section>

      {/* 9. qué te importa */}
      <Section title="¿Qué es lo que más te importa de esto?" n={9}>
        <input value={f.importa ?? ""} maxLength={200}
          onChange={(e) => setF({ ...f, importa: e.target.value })}
          placeholder="En una frase, con tus palabras (máx. 200 caracteres)"
          className="mb-3 w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <ChipGrid options={TEMAS_OPTS} selected={f.temas} onToggle={toggleTema} accent="#d97c50" />
      </Section>

      {/* 10. escala y exit — la desalineación de visión es la fisura más predecible */}
      <Section title="Si esto sale bien, ¿cómo acaba?" n={10}>
        <div className="grid gap-2">
          {EXIT_OPTS.map((o) => (
            <Choice key={o.value} active={f.exit_ideal === o.value} title={o.label} hint={o.hint}
              onClick={() => setF({ ...f, exit_ideal: o.value })} wide />
          ))}
        </div>
      </Section>

      {/* 11. compromiso real: horas proyectadas + runway personal */}
      <Section title="¿Y dentro de 6 meses, cuántas horas?" n={11}
        hint="lo que puedas sostener, no lo que te gustaría">
        <div className="flex flex-wrap gap-2">
          {HORAS_OPTS.map((h) => (
            <Choice key={h.value} active={f.horas_6m === h.value} title={h.label} hint={h.hint}
              onClick={() => setF({ ...f, horas_6m: h.value })} />
          ))}
        </div>
        <div className="mt-4 mb-2 text-sm font-medium" style={{ color: "var(--text)" }}>
          ¿Cuántos meses puedes vivir sin cobrar de esto?
        </div>
        <div className="flex flex-wrap gap-2">
          {RUNWAY_OPTS.map((o) => (
            <Choice key={o.value} active={f.runway_meses === o.value} title={o.label} hint={o.hint}
              onClick={() => setF({ ...f, runway_meses: o.value })} />
          ))}
        </div>
      </Section>

      {/* 12. conflicto situacional — reparar importa más que no discutir */}
      <Section title="Cuéntame un choque real: uno que gestionaste bien y otro que gestionaste mal" n={12}
        hint="lo que de verdad predice que un equipo dure no es discutir poco, sino saber reconciliarse">
        <textarea value={f.conflicto_reparacion ?? ""} maxLength={400} rows={4}
          onChange={(e) => setF({ ...f, conflicto_reparacion: e.target.value })}
          placeholder="Qué pasó, qué hiciste y cómo acabó. Dos ejemplos cortos bastan."
          className="w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <div className="mt-1 text-right text-[11px]" style={{ color: "var(--text-dimmer)" }}>
          {(f.conflicto_reparacion ?? "").length}/400
        </div>
      </Section>

      {/* 13. áreas de responsabilidad + pasión (AoR) — complementariedad medible */}
      <Section title="¿De qué te puedes hacer cargo tú?" n={13}
        hint="del 1 al 10 · marca la llama si además te apasiona">
        <div className="space-y-1.5">
          {AREAS.map((a) => (
            <AreaRow key={a.value} label={a.label} rating={f.areas[a.value]}
              onNivel={(n) => setAreaNivel(a.value, n)}
              onPasion={() => toggleAreaPasion(a.value)} />
          ))}
        </div>
      </Section>

      {/* 14. equity y control — la tensión más alta y peor gestionada */}
      <Section title="Si mañana montaras algo con alguien, ¿cómo repartiríais?" n={14}
        hint="el 73% de los equipos reparte en el primer mes, casi siempre sin hablarlo a fondo">
        <div className="grid gap-2">
          {EQUITY_OPTS.map((o) => (
            <Choice key={o.value} active={f.equity_split === o.value} title={o.label} hint={o.hint}
              onClick={() => setF({ ...f, equity_split: o.value })} wide />
          ))}
        </div>
        <div className="h-4" />
        <Scale left="Prefiero mandar aunque gane menos" right="Prefiero ganar más aunque no mande"
          value={f.king_o_rich} onChange={(v) => setF({ ...f, king_o_rich: v })} />
      </Section>

      {/* ── Ponderación declarada por el usuario (estilo OkCupid) ───────────── */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
          ¿Qué es lo que más te importa de un socio?
        </div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Marca hasta {MAX_PESOS_USUARIO}. MERGE dará más peso a esas categorías al puntuar tus
          conexiones y te enseñará cómo cambia la nota.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {RUBRICA.map((r) => {
            const active = f.pesos_usuario.includes(r.key)
            return (
              <button key={r.key} onClick={() => togglePeso(r.key)} title={r.evalua}
                className="rounded-full px-3 py-1.5 text-sm transition"
                style={{
                  background: active ? "rgba(194, 84, 47,0.18)" : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  color: active ? "var(--text)" : "var(--text-dim)",
                }}>
                {r.label} <span className="tabular-nums opacity-60">{pesos[r.key]}%</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Opcionales: se piden después para no matar el onboarding ────────── */}
      <div>
        <button onClick={() => setShowExtra((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
          <span>
            <span className="block text-sm font-medium" style={{ color: "var(--text)" }}>
              Completa tu perfil para mejores matches
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-dim)" }}>
              3 preguntas opcionales · {extra.done}/{extra.total} respondidas
            </span>
          </span>
          <span className="text-lg" style={{ color: "var(--text-dim)" }}>{showExtra ? "−" : "+"}</span>
        </button>

        {showExtra && (
          <div className="mt-5 space-y-7">
            {/* 15. mini Big Five — señal complementaria, nunca filtro */}
            <Section title="¿Cómo eres cuando nadie te mira?" n={15}
              hint="señal, no veredicto: nunca descartamos a nadie por esto">
              <div className="space-y-3">
                {BIG_FIVE_SCALES.map((s) => (
                  <Scale key={s.key} left={s.left} right={s.right}
                    value={f.big_five[s.key]} onChange={(v) => setBigFive(s.key, v)} />
                ))}
              </div>
            </Section>

            {/* 16. historial de colaboración previa */}
            <Section title="¿Has montado algo antes con otra persona?" n={16}>
              <div className="grid gap-2">
                {COLABORACION_OPTS.map((o) => (
                  <Choice key={o.value} active={f.colaboracion_previa === o.value} title={o.label} hint=""
                    onClick={() => setF({ ...f, colaboracion_previa: o.value })} wide />
                ))}
              </div>
              {f.colaboracion_previa && f.colaboracion_previa !== "nunca" && (
                <textarea value={f.colaboracion_detalle ?? ""} maxLength={300} rows={3}
                  onChange={(e) => setF({ ...f, colaboracion_detalle: e.target.value })}
                  placeholder="¿Cómo terminó y qué aprendiste? (máx. 300 caracteres)"
                  className="mt-3 w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
              )}
            </Section>

            {/* 17. cultura ideal */}
            <Section title="Completa la frase" n={17}>
              <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
                «Estaría orgulloso de que describieran la cultura de mi empresa como…»
              </p>
              <input value={f.cultura_ideal ?? ""} maxLength={200}
                onChange={(e) => setF({ ...f, cultura_ideal: e.target.value })}
                placeholder="Con tus palabras (máx. 200 caracteres)"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </Section>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-t1 transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #c2542f, #a34420)" }}>
          {saving ? "Guardando…" : "Guardar perfil avanzado"}
        </button>
        {msg && <span className="text-sm" style={{ color: "var(--text-dim)" }}>{msg}</span>}
      </div>
    </div>
  )

  // ── subcomponentes ──
  function Section({ title, n, hint, children }: {
    title: string; n: number; hint?: string; children: React.ReactNode
  }) {
    return (
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>{n}</span>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{title}</span>
          {hint && <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>{hint}</span>}
        </div>
        {children}
      </div>
    )
  }
}

function Choice({ active, title, hint, wide, onClick }: {
  active: boolean; title: string; hint: string; wide?: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} title={hint}
      className={`rounded-xl px-3 py-2 text-left transition ${wide ? "w-full" : ""}`}
      style={{
        background: active ? "rgba(194, 84, 47,0.15)" : "var(--surface-3)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}>
      <span className="block text-sm font-medium" style={{ color: "var(--text)" }}>{title}</span>
      {hint && <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>{hint}</span>}
    </button>
  )
}

function ChipGrid<T extends string>({ options, selected, onToggle, accent }: {
  options: { value: T; label: string }[]
  selected: T[]; onToggle: (v: T) => void; accent: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button key={o.value} onClick={() => onToggle(o.value)}
            className="rounded-full px-3 py-1.5 text-sm transition"
            style={{
              background: active ? `${accent}22` : "var(--surface-3)",
              border: `1px solid ${active ? accent : "var(--border)"}`,
              color: active ? "var(--text)" : "var(--text-dim)",
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Una fila del mapa de áreas de responsabilidad (AoR): nivel 1-10 + pasión.
 * Nivel 0 (botón "—") significa "esto no lo llevo yo" y saca el área del mapa,
 * que es justo la señal de dónde necesitas a la otra persona.
 */
function AreaRow({ label, rating, onNivel, onPasion }: {
  label: string
  rating: AreaRating | undefined
  onNivel: (n: number) => void
  onPasion: () => void
}) {
  const nivel = rating?.nivel ?? 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-[38%] shrink-0 truncate text-[13px]" style={{ color: "var(--text)" }} title={label}>
        {label}
      </span>
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onNivel(nivel === n ? 0 : n)} aria-label={`${label}: ${n} de 10`}
            className="h-6 flex-1 rounded-[4px] transition"
            style={{
              background: n <= nivel ? "var(--accent)" : "var(--surface-3)",
              border: `1px solid ${n <= nivel ? "var(--accent)" : "var(--border)"}`,
              opacity: n <= nivel ? 0.35 + (n / 10) * 0.65 : 1,
            }} />
        ))}
      </div>
      <button onClick={onPasion} disabled={!rating}
        aria-label={`Me apasiona: ${label}`} title="Además me apasiona"
        className="w-6 shrink-0 text-center text-[14px] transition disabled:opacity-25"
        style={{ color: rating?.pasion ? "var(--amber)" : "var(--text-dimmer)" }}>
        {rating?.pasion ? "🔥" : "○"}
      </button>
    </div>
  )
}

/** Escala de 4 puntos entre dos anclas conductuales. */
function Scale({ left, right, value, onChange }: {
  left: string; right: string; value: number | null; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px]" style={{ color: "var(--text-dim)" }}>
        <span className="max-w-[45%]">{left}</span>
        <span className="max-w-[45%] text-right">{right}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((v) => (
          <button key={v} onClick={() => onChange(v)} aria-label={`${v} de 4`}
            className="h-8 flex-1 rounded-lg transition"
            style={{
              background: value === v ? "rgba(194, 84, 47,0.25)" : "var(--surface-3)",
              border: `1px solid ${value === v ? "var(--accent)" : "var(--border)"}`,
            }} />
        ))}
      </div>
    </div>
  )
}
