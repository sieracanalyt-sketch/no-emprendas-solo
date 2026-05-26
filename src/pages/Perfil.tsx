import { useEffect, useState } from "react"
import { auth, db } from "../firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"

export default function Perfil() {
  const [perfil, setPerfil] = useState({
    nombre: "",
    biografia: "",
    proyecto: ""
  })

  const [buscando, setBuscando] = useState<string[]>([])
  const [inputTag, setInputTag] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarPerfil()
  }, [])

  const cargarPerfil = async () => {
    const user = auth.currentUser
    if (!user) return

    const ref = doc(db, "users", user.uid)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const data = snap.data()

      setPerfil({
        nombre: data.nombre || "",
        biografia: data.biografia || "",
        proyecto: data.proyecto || ""
      })

      setBuscando(data.buscando || [])
    }

    setLoading(false)
  }

  const guardarPerfil = async () => {
    const user = auth.currentUser
    if (!user) return

    await setDoc(doc(db, "users", user.uid), {
      ...perfil,
      buscando
    }, { merge: true })

    alert("Perfil actualizado")
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

  if (loading) return <p className="text-center text-gray-300 mt-10">Cargando...</p>

  return (
    <div className="w-full flex justify-center px-4 mt-10">
      <div className="w-full max-w-3xl bg-[#111] border border-white/10 rounded-2xl p-10 shadow-xl">

        {/* TÍTULO */}
        <h2 className="text-3xl font-bold text-white mb-10 text-center tracking-tight">
          Tu Perfil
        </h2>

        <div className="space-y-8">

          {/* Nombre */}
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Nombre</label>
            <input
              value={perfil.nombre}
              onChange={e => setPerfil({ ...perfil, nombre: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white"
            />
          </div>

          {/* Biografía */}
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Biografía</label>
            <textarea
              value={perfil.biografia}
              onChange={e => setPerfil({ ...perfil, biografia: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white h-32 resize-none"
            />
          </div>

          {/* Proyecto */}
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">Proyecto</label>
            <input
              value={perfil.proyecto}
              onChange={e => setPerfil({ ...perfil, proyecto: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block mb-2 text-gray-400 text-sm font-medium">
              Tipo de persona que buscas
            </label>

            <div className="flex flex-wrap gap-2 mb-3">
              {buscando.map((tag, i) => (
                <div
                  key={i}
                  className="bg-purple-600/80 px-4 py-2 rounded-full flex items-center gap-2 text-sm text-white shadow-md"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(i)}
                    className="text-white/80 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <input
              value={inputTag}
              onChange={e => setInputTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe y pulsa Enter..."
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1d] border border-white/10 focus:border-purple-500 outline-none transition text-white"
            />
          </div>

        </div>

        {/* Botón guardar */}
        <button
          onClick={guardarPerfil}
          className="w-full mt-10 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-lg text-white shadow-lg transition"
        >
          Guardar cambios
        </button>

      </div>
    </div>
  )
}
