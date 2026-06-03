import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useNavigate } from "react-router-dom"

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

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 animate-in">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Tu perfil</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Actualiza tu información pública
        </p>
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
