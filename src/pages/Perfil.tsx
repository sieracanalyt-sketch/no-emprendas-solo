import { useEffect, useState } from "react"
import { auth, db } from "../firebase"
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore"
import { deleteUser } from "firebase/auth"
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
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      if (snap.exists()) {
        const data = snap.data()
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
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    await setDoc(
      doc(db, "users", user.uid),
      { ...perfil, buscando },
      { merge: true }
    )
    setSaving(false)
    alert("Perfil actualizado")
  }

  const eliminarCuenta = async () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer."
    )
    if (!confirmed) return

    try {
      const user = auth.currentUser
      if (!user) return
      await deleteDoc(doc(db, "users", user.uid))
      await deleteUser(user)
      navigate("/")
    } catch {
      alert(
        "Por seguridad, Firebase requiere que vuelvas a iniciar sesión antes de eliminar la cuenta."
      )
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
        <p className="text-white/40 text-sm">Cargando…</p>
      </div>
    )

  /* ---- shared input style ---- */
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* TITLE */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Tu perfil</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Actualiza tu información pública
        </p>
      </div>

      <div
        className="rounded-xl p-6 space-y-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Nombre */}
        <Field label="Nombre">
          <input
            value={perfil.nombre}
            onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition focus:border-white/25"
            style={inputStyle}
          />
        </Field>

        {/* Biografía */}
        <Field label="Biografía">
          <textarea
            value={perfil.biografia}
            onChange={(e) => setPerfil({ ...perfil, biografia: e.target.value })}
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition resize-none focus:border-white/25"
            style={inputStyle}
          />
        </Field>

        {/* Proyecto */}
        <Field label="Proyecto">
          <input
            value={perfil.proyecto}
            onChange={(e) => setPerfil({ ...perfil, proyecto: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition focus:border-white/25"
            style={inputStyle}
          />
        </Field>

        {/* Tags */}
        <Field label="Tipo de persona que buscas">
          {buscando.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {buscando.map((tag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(i)}
                    className="text-white/50 hover:text-white transition-colors leading-none"
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
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition focus:border-white/25"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* GUARDAR */}
      <button
        onClick={guardarPerfil}
        disabled={saving}
        className="w-full mt-4 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>

      {/* SEPARATOR */}
      <div
        className="my-6"
        style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
      />

      {/* ZONA DE PELIGRO */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "rgba(239,68,68,0.04)",
          border: "1px solid rgba(239,68,68,0.12)",
        }}
      >
        <p className="text-white text-sm font-medium mb-1">Eliminar cuenta</p>
        <p className="text-white/40 text-xs mb-4">
          Esta acción es permanente. Todos tus datos serán borrados y no podrás
          recuperarlos.
        </p>
        <button
          onClick={eliminarCuenta}
          className="px-4 py-2 text-sm font-medium rounded-lg transition"
          style={{
            color: "rgb(248 113 113)",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          Eliminar mi cuenta
        </button>
      </div>

    </div>
  )
}

/* ---- helper ---- */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}
