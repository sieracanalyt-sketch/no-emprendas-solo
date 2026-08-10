import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"

export default function CompletarPerfil() {
  const [nombre, setNombre] = useState("")
  const [biografia, setBiografia] = useState("")
  const [proyecto, setProyecto] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setMensaje("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setMensaje("No se encontró el usuario"); return }

      const { error } = await supabase
        .from("users")
        .update({ nombre, biografia, proyecto })
        .eq("id", user.id)

      if (error) { setMensaje("Error al guardar el perfil"); return }
      navigate("/explorar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full flex justify-center px-4 mt-10">
      <div className="glass w-full max-w-3xl rounded-3xl p-10">
        <h2 className="text-3xl font-bold text-t1 mb-10 text-center tracking-tight">
          Completa tu perfil
        </h2>
        <div className="space-y-8">
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Nombre</label>
            <input
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-3 rounded-xl field-input text-t1"
            />
          </div>
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Biografía</label>
            <textarea
              placeholder="Cuéntanos sobre ti"
              value={biografia}
              onChange={(e) => setBiografia(e.target.value)}
              className="w-full px-4 py-3 rounded-xl field-input text-t1 h-32 resize-none"
            />
          </div>
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Proyecto</label>
            <input
              type="text"
              placeholder="¿En qué proyecto trabajas?"
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl field-input text-t1"
            />
          </div>
        </div>

        {mensaje && <p className="mt-4 text-red-400 text-sm text-center">{mensaje}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-10 py-4 rounded-full font-semibold text-lg text-t1 transition disabled:opacity-50 hover:brightness-110"
          style={{
            background: "linear-gradient(180deg, #d97c50, #c2542f)",
            border: "1px solid rgba(var(--overlay-rgb), 0.14)",
            boxShadow: "0 10px 30px rgba(194, 84, 47,0.35), inset 0 1px 0 rgba(var(--overlay-rgb), 0.18)",
          }}
        >
          {saving ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  )
}
