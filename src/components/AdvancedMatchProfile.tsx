import { useEffect, useState } from "react"
import {
  ARCHETYPES, GENIUSES, RECIPROCITIES, DISCS,
  loadMatchProfile, saveMatchProfile, EMPTY_PROFILE,
  type MatchProfileFields, type Genius,
} from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Perfil de Matchmaking Avanzado (premium). Los campos alimentan el motor
// nes_match_advanced. Guardar está protegido por RLS: solo premium/trial/admin.
// ──────────────────────────────────────────────────────────────────────────────

function toChips(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8)
}

export default function AdvancedMatchProfile({ userId }: { userId: string }) {
  const [f, setF] = useState<MatchProfileFields>(EMPTY_PROFILE)
  const [offersText, setOffersText] = useState("")
  const [needsText, setNeedsText] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    let alive = true
    loadMatchProfile(userId).then((p) => {
      if (!alive) return
      setF(p)
      setOffersText(p.offers.join(", "))
      setNeedsText(p.needs.join(", "))
      setLoading(false)
    })
    return () => { alive = false }
  }, [userId])

  // multiselect con tope de 2 (Working Genius: 2 genios + 2 frustraciones)
  function toggleGenius(key: "genius" | "frustration", value: Genius) {
    setF((prev) => {
      const cur = prev[key]
      const has = cur.includes(value)
      const next = has ? cur.filter((g) => g !== value) : [...cur, value].slice(-2)
      // evita que el mismo valor esté en genio y frustración a la vez
      const other = key === "genius" ? "frustration" : "genius"
      return { ...prev, [key]: next, [other]: prev[other].filter((g) => g !== value) }
    })
  }

  async function handleSave() {
    if (saving) return
    setSaving(true); setMsg("")
    const payload: MatchProfileFields = {
      ...f, offers: toChips(offersText), needs: toChips(needsText),
      superpower: f.superpower?.trim() || null,
    }
    const { error } = await saveMatchProfile(userId, payload)
    setSaving(false)
    setMsg(error ? "No se pudo guardar (¿tu cuenta es premium?)" : "Perfil avanzado guardado ✓")
    if (!error) setF(payload)
  }

  if (loading) return <div className="text-sm" style={{ color: "var(--text-dim)" }}>Cargando…</div>

  return (
    <div className="space-y-7">
      {/* Rocket Fuel */}
      <Section title="Arquetipo" book="Rocket Fuel">
        <div className="flex flex-wrap gap-2">
          {ARCHETYPES.map((a) => (
            <Choice key={a.value} active={f.archetype === a.value} title={a.label} hint={a.hint}
              onClick={() => setF({ ...f, archetype: a.value })} />
          ))}
        </div>
      </Section>

      {/* Working Genius */}
      <Section title="Tus 2 genios (lo que te energiza)" book="Working Genius">
        <ChipGrid options={GENIUSES} selected={f.genius} onToggle={(v) => toggleGenius("genius", v)} accent="#8b7bff" />
      </Section>
      <Section title="Tus 2 frustraciones (lo que te drena)" book="Working Genius">
        <ChipGrid options={GENIUSES} selected={f.frustration} onToggle={(v) => toggleGenius("frustration", v)} accent="#c96b6b" />
      </Section>

      {/* Give and Take */}
      <Section title="Estilo de reciprocidad" book="Give and Take">
        <div className="flex flex-wrap gap-2">
          {RECIPROCITIES.map((r) => (
            <Choice key={r.value} active={f.reciprocity === r.value} title={r.label} hint={r.hint}
              onClick={() => setF({ ...f, reciprocity: r.value })} />
          ))}
        </div>
      </Section>

      {/* DISC */}
      <Section title="Estilo de comunicación" book="DISC · Rodeado de Idiotas">
        <div className="flex flex-wrap gap-2">
          {DISCS.map((d) => (
            <Choice key={d.value} active={f.disc === d.value} title={d.label} hint={d.hint} dot={d.color}
              onClick={() => setF({ ...f, disc: d.value })} />
          ))}
        </div>
      </Section>

      {/* Ofertas / Necesidades */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qué ofreces (coma)" value={offersText} onChange={setOffersText}
          placeholder="ventas, diseño, fundraising" />
        <Field label="Qué necesitas (coma)" value={needsText} onChange={setNeedsText}
          placeholder="ops, desarrollo, marketing" />
      </div>
      <Field label="Tu superpoder (una línea)" value={f.superpower ?? ""}
        onChange={(v) => setF({ ...f, superpower: v })} placeholder="Convierto ideas caóticas en roadmaps" />

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
  function Section({ title, book, children }: { title: string; book: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{title}</span>
          <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--accent)" }}>{book}</span>
        </div>
        {children}
      </div>
    )
  }
}

function Choice({ active, title, hint, dot, onClick }: {
  active: boolean; title: string; hint: string; dot?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} title={hint}
      className="rounded-xl px-3 py-2 text-left transition"
      style={{
        background: active ? "rgba(94,106,210,0.15)" : "var(--surface-3)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}>
      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text)" }}>
        {dot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />}
        {title}
      </span>
      <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>{hint}</span>
    </button>
  )
}

function ChipGrid<T extends string>({ options, selected, onToggle, accent }: {
  options: { value: T; label: string; hint: string }[]
  selected: T[]; onToggle: (v: T) => void; accent: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button key={o.value} onClick={() => onToggle(o.value)} title={o.hint}
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

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-dim)" }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition"
        style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
    </div>
  )
}
