import { useEffect, useState } from "react"
import {
  ROLES, FORTALEZAS, AMBICION, HORAS_OPTS, FIABILIDAD_OPTS, CONFLICTO_OPTS, TEMAS_OPTS,
  loadMatchProfile, saveMatchProfile, profileCompletion, EMPTY_PROFILE,
  type MatchProfileFields, type Fortaleza, type Tema,
} from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Perfil de Matchmaking Avanzado (premium): los 9 campos conductuales del
// documento de investigación. Lenguaje de la calle, cero jerga psicológica.
// Guardar está protegido por RLS: solo premium/trial/admin.
// ──────────────────────────────────────────────────────────────────────────────

export default function AdvancedMatchProfile({ userId }: { userId: string }) {
  const [f, setF] = useState<MatchProfileFields>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

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

  async function handleSave() {
    if (saving) return
    setSaving(true); setMsg("")
    const payload: MatchProfileFields = { ...f, importa: f.importa?.trim().slice(0, 200) || null }
    const { error } = await saveMatchProfile(userId, payload)
    setSaving(false)
    setMsg(error ? "No se pudo guardar (¿tu cuenta es premium?)" : "Perfil guardado ✓")
    if (!error) setF(payload)
  }

  if (loading) return <div className="text-sm" style={{ color: "var(--text-dim)" }}>Cargando…</div>

  const prog = profileCompletion(f)

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
          onToggle={(v) => toggleMax2("fuerte_en", v)} accent="#3fca7d" />
      </Section>

      {/* 3. necesitas */}
      <Section title="¿Qué necesitas que traiga la otra persona?" n={3} hint="máx. 2">
        <ChipGrid options={FORTALEZAS} selected={f.necesita}
          onToggle={(v) => toggleMax2("necesita", v)} accent="#8b7bff" />
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
        <ChipGrid options={TEMAS_OPTS} selected={f.temas} onToggle={toggleTema} accent="#ffca3a" />
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #5e6ad2, #4f5ac0)" }}>
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
        background: active ? "rgba(94,106,210,0.15)" : "var(--surface-3)",
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
              background: value === v ? "rgba(94,106,210,0.25)" : "var(--surface-3)",
              border: `1px solid ${value === v ? "var(--accent)" : "var(--border)"}`,
            }} />
        ))}
      </div>
    </div>
  )
}
