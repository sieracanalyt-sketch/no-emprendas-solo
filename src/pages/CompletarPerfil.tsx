import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"

export default function CompletarPerfil() {
  const [nombre, setNombre] = useState("")
  const [biografia, setBiografia] = useState("")
  const [proyecto, setProyecto] = useState("")
  const [mensaje, setMensaje] = useState("")
  const navigate = useNavigate()

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMensaje("No se encontró el usuario")
      return
    }

    const { error } = await supabase
      .from("users")
      .update({ nombre, biografia, proyecto })
      .eq("id", user.id)

    if (error) {
      console.error(error)
      setMensaje("Error al guardar el perfil")
      return
    }

    navigate("/explorar")
  }

  return (
    <div className="w-full flex justify-center px-4 mt-10">
      <div className="w-full max-w-3xl bg-[#111] border border-white/10 rounded-2xl p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-white mb-10 text-center tracking-tight">
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
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white"
            />
          </div>
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Biografía</label>
            <textarea
              placeholder="Cuéntanos sobre ti"
              value={biografia}
              onChange={(e) => setBiografia(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white h-32 resize-none"
            />
          </div>
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Proyecto</label>
            <input
              type="text"
              placeholder="¿En qué proyecto trabajas?"
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white"
            />
          </div>
        </div>

        {mensaje && <p className="mt-4 text-red-400 text-sm text-center">{mensaje}</p>}

        <button
          onClick={handleSave}
          className="w-full mt-10 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-lg text-white shadow-lg transition"
        >
          Guardar y continuar
        </button>
      </div>
    </div>
  )
}
