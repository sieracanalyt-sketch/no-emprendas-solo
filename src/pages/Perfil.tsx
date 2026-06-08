import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useNavigate } from "react-router-dom"
import { checkProfile, MIN_BIO } from "../lib/profileCompletion"

export default function Perfil() {
  const [perfil, setPerfil] = useState({ nombre: "", biografia: "", proyecto: "" })
  const [buscando, setBuscando] = useState<string[]>([])
  const [inputTag, setInputTag] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const cargarPerfil = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single()
      if (data) {
        setPerfil({
          nombre: data.nombre || "",
          biografia: data.biografia || "",
          proyecto: data.proyecto || "",
        })
        setBuscando(data.buscando || [])
      }
      setLoading(false)
    }
    cargarPerfil()
  }, [])

  const guardarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase.from("users").update({ ...perfil, buscando }).eq("id", user.id)
    setSaving(false)
    alert("Perfil actualizado")
  }

  const eliminarCuenta = async () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer."
    )
    if (!confirmed) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from("users").delete().eq("id", user.id)
      await supabase.rpc("delete_user")
      navigate("/")
    } catch {
      alert("Error al eliminar la cuenta. Inténtalo de nuevo.")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputTag.trim() !== "") {
      e.preventDefault()
      setBuscando([...buscando, inputTag.trim()])
      setInputTag("")
    }
  }

  const removeTag = (index: number) => {
    setBuscando(buscando.filter((_, i) => i !== index))
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando…</p>
      </div>
    )

  const check = checkProfile({ ...perfil, buscando })
  const bioLen = perfil.biografia.trim().length

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 animate-in">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Tu perfil</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Actualiza tu información pública
        </p>
      </div>

      {/* Estado del gate de conexión: indica si ya puede conectar en NES Connect */}
      <div
        className="mb-6 rounded-xl p-4"
        style={{
          background: check.complete
            ? "linear-gradient(180deg, rgba(52,211,153,0.10), rgba(52,211,153,0.03)), var(--surface)"
            : "linear-gradient(180deg, rgba(94,106,210,0.10), rgba(94,106,210,0.03)), var(--surface)",
          border: `1px solid ${check.complete ? "rgba(52,211,153,0.35)" : "rgba(94,106,210,0.35)"}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: check.complete ? "#7ee2b8" : "#aab2f0" }}>
            {check.complete ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            )}
          </span>
          <h2 className="text-[14px] font-semibold text-white">
            {check.complete ? "Perfil completo — ya puedes conectar" : "Completa tu perfil para poder conectar"}
          </h2>
        </div>
        {!check.complete && (
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-dim)" }}>
            Hasta entonces no podrás conectar con otros fundadores en NES Connect. Te faltan {check.missingCount} {check.missingCount === 1 ? "apartado" : "apartados"}:
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {check.items.map((it) => (
            <span
              key={it.key}
              className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full"
              style={{
                background: it.ok ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${it.ok ? "rgba(52,211,153,0.30)" : "var(--border)"}`,
                color: it.ok ? "#7ee2b8" : "var(--text-dim)",
              }}
            >
              {it.ok ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <span className="w-[11px] h-[11px] rounded-full border" style={{ borderColor: "var(--text-dimmer)" }} />
              )}
              {it.label}
              {it.key === "biografia" && it.detail && (
                <span style={{ color: it.ok ? "#7ee2b8" : "var(--text-dimmer)" }}>· {it.detail}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div
        className="rounded-lg p-6 space-y-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Field label="Nombre">
          <input
            value={perfil.nombre}
            onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
            className="field-input w-full px-3.5 py-2 rounded-md text-[14px]"
          />
        </Field>
        <Field label="Biografía">
          <textarea
            value={perfil.biografia}
            onChange={(e) => setPerfil({ ...perfil, biografia: e.target.value })}
            rows={4}
            className="field-input w-full px-3.5 py-2.5 rounded-md text-[14px] resize-none leading-relaxed"
          />
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>
              {bioLen >= MIN_BIO ? "¡Perfecto!" : `Te faltan ${MIN_BIO - bioLen} caracteres`}
            </span>
            <span className="text-[11px] font-medium" style={{ color: bioLen >= MIN_BIO ? "#7ee2b8" : "var(--text-dim)" }}>
              {bioLen}/{MIN_BIO}
            </span>
          </div>
        </Field>
        <Field label="Proyecto">
          <input
            value={perfil.proyecto}
            onChange={(e) => setPerfil({ ...perfil, proyecto: e.target.value })}
            className="field-input w-full px-3.5 py-2 rounded-md text-[14px]"
          />
        </Field>
        <Field label="Tipo de persona que buscas">
          {buscando.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {buscando.map((tag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-white"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(i)}
                    className="leading-none transition-colors"
                    style={{ color: "var(--text-dim)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            value={inputTag}
            onChange={(e) => setInputTag(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe y pulsa Enter…"
            className="field-input w-full px-3.5 py-2 rounded-md text-[14px]"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={guardarPerfil}
          disabled={saving}
          className="px-5 py-2 bg-white text-black text-[13px] font-semibold rounded-md hover:bg-white/90 transition disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <div className="my-7" style={{ height: "1px", background: "var(--border)" }} />

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: "var(--text-dim)" }}>
            Eliminar cuenta
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-dimmer)" }}>
            Esta acción es permanente. Todos tus datos serán borrados.
          </p>
        </div>
        <button
          onClick={eliminarCuenta}
          className="shrink-0 text-[13px] font-medium transition-colors"
          style={{ color: "rgba(239,68,68,0.8)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(239,68,68)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(239,68,68,0.8)")}
        >
          Eliminar mi cuenta
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text-dimmer)" }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
