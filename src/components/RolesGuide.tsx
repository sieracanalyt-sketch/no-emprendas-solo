import { useEffect, useMemo, useState } from "react"
import { ROLE_CATEGORIES, MAIN_QUICK_ROLES, CRITICAL_ROLES } from "../lib/roles"

// ──────────────────────────────────────────────────────────────────────────────
// GUÍA DE ROLES — "¿qué significa cada rol?"
//
// Un chip que pone "Diseñador UX / UI" no sirve de nada si no sabes qué hace esa
// persona. Aquí se explica cada uno de los roles de NES en una línea, agrupados
// por área, para que puedas decidir qué le falta a tu equipo.
// ──────────────────────────────────────────────────────────────────────────────

export default function RolesGuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)" }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)" }}
        title="Qué significa cada rol y cuál le falta a tu equipo"
      >
        ? Qué son los roles
      </button>
      {open && <RolesGuideModal onClose={() => setOpen(false)} />}
    </>
  )
}

function RolesGuideModal({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState<string | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])

  const query = q.trim().toLowerCase()
  const shown = useMemo(
    () => ROLE_CATEGORIES
      .filter(c => !cat || c.label === cat)
      .map(c => ({
        ...c,
        roles: query
          ? c.roles.filter(r => r.name.toLowerCase().includes(query) || r.desc.toLowerCase().includes(query))
          : c.roles,
      }))
      .filter(c => c.roles.length > 0),
    [cat, query]
  )
  const total = ROLE_CATEGORIES.reduce((n, c) => n + c.roles.length, 0)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.65)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(30,32,38,0.97), rgba(17,19,23,0.97))",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.08)",
          maxHeight: "88vh",
          animation: "modal-pop 0.28s cubic-bezier(0.34,1.2,0.64,1) both",
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <style>{`@keyframes modal-pop{0%{opacity:0;transform:scale(0.94) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Cabecera */}
        <div className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-white tracking-tight">¿Qué significan los roles?</h2>
            <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>
              El rol dice qué aporta cada persona al proyecto. Sirve para dos cosas: repartir tareas
              sin discutir quién hace qué, y ver de un vistazo qué perfil te falta.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[14px] transition"
            style={{ color: "var(--text-dim)", background: "rgba(255,255,255,0.04)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
            aria-label="Cerrar guía de roles"
          >
            ✕
          </button>
        </div>

        {/* Buscador + filtros */}
        <div className="shrink-0 px-6 pt-4 pb-3 flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder={`Buscar entre los ${total} roles…`}
            className="field-input w-full px-3 py-1.5 rounded-md text-[12.5px]"
          />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCat(null)}
              className="text-[11px] px-2.5 py-1 rounded-full transition"
              style={{ background: !cat ? "rgba(255,255,255,0.1)" : "transparent", color: !cat ? "#fff" : "var(--text-dimmer)", border: "1px solid var(--border)" }}>
              Todas
            </button>
            {ROLE_CATEGORIES.map(c => (
              <button key={c.label} onClick={() => setCat(cat === c.label ? null : c.label)}
                className="text-[11px] px-2.5 py-1 rounded-full transition"
                style={{
                  background: cat === c.label ? `${c.color}22` : "transparent",
                  color: cat === c.label ? c.color : "var(--text-dimmer)",
                  border: `1px solid ${cat === c.label ? c.color + "44" : "var(--border)"}`,
                }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Los tres atajos: lo primero que ve el usuario al asignar un rol */}
          {!query && !cat && (
            <section>
              <h3 className="text-[14.5px] font-semibold text-white mb-1">Los tres atajos rápidos</h3>
              <p className="text-[12.5px] leading-relaxed mb-2.5" style={{ color: "var(--text-dim)" }}>
                Al asignar un rol te salen primero estos tres. No son cargos: son <b>áreas</b>, para
                salir del paso cuando aún no sabes el título exacto. Puedes afinarlo después.
              </p>
              <div className="flex flex-col gap-1.5">
                {MAIN_QUICK_ROLES.map(r => (
                  <div key={r.name} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                    style={{ background: `${r.color}12`, border: `1px solid ${r.color}33` }}>
                    <span style={{ fontSize: 16 }}>{r.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold" style={{ color: r.color }}>{r.name}</p>
                      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {shown.length === 0 && (
            <p className="text-[12.5px] text-center py-8" style={{ color: "var(--text-dimmer)" }}>
              Ningún rol coincide con "{q}".
            </p>
          )}

          {shown.map(c => (
            <section key={c.label}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0"
                  style={{ background: `${c.color}1c`, border: `1px solid ${c.color}3a` }}>
                  {c.emoji}
                </span>
                <h3 className="text-[14.5px] font-semibold text-white">{c.label}</h3>
                <span className="text-[10.5px] px-1.5 py-0.5 rounded-md" style={{ color: c.color, background: `${c.color}18` }}>
                  {c.roles.length}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed mb-2.5" style={{ color: "var(--text-dim)" }}>{c.blurb}</p>
              <div className="flex flex-col gap-1.5">
                {c.roles.map(r => {
                  const critical = CRITICAL_ROLES.includes(r.name)
                  return (
                    <div key={r.name} className="px-3.5 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.028)", border: "1px solid var(--border)" }}>
                      <p className="text-[12.5px] font-semibold flex items-center gap-2 flex-wrap" style={{ color: c.color }}>
                        {r.name}
                        {critical && (
                          <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(242,153,74,0.14)", color: "#f2994a", border: "1px solid rgba(242,153,74,0.3)" }}>
                            clave para un equipo de producto
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: "var(--text-dim)" }}>{r.desc}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Pie */}
        <div className="shrink-0 px-6 py-3 text-[11.5px] leading-relaxed"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-dimmer)" }}>
          ¿No encuentras el tuyo? Usa <b style={{ color: "var(--text-dim)" }}>+ Crear rol</b> para inventar uno,
          o abre <b style={{ color: "var(--text-dim)" }}>Ver todos los roles</b> y responde las dos preguntas del
          cuestionario: te propone el perfil que mejor encaja contigo.
        </div>
      </div>
    </div>
  )
}
