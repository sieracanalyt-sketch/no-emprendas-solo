import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { db } from "../firebase"
import { doc, getDoc } from "firebase/firestore"

export default function PerfilPublico() {
  const { id } = useParams()
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    const ref = doc(db, "users", id!)
    const snap = await getDoc(ref)
    if (snap.exists()) setUserData(snap.data())
  }

  if (!userData) return <p className="text-center text-white mt-10">Cargando...</p>

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 p-6 bg-gray-900 text-white rounded-2xl shadow-xl border border-gray-700">

      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-4xl font-bold">
          {userData.nombre?.charAt(0)?.toUpperCase()}
        </div>
        <h2 className="text-3xl font-bold mt-4">{userData.nombre}</h2>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Biografía</h3>
        <p className="text-gray-300">{userData.biografia || "Sin biografía"}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Proyecto</h3>
        <p className="text-gray-300">{userData.proyecto || "Sin proyecto"}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Busca</h3>
        <div className="flex flex-wrap gap-2">
          {userData.buscando?.length > 0 ? (
            userData.buscando.map((tag: string, i: number) => (
              <span key={i} className="bg-blue-600 px-3 py-1 rounded-full text-sm">
                {tag}
              </span>
            ))
          ) : (
            <p className="text-gray-400">No ha especificado nada</p>
          )}
        </div>
      </div>

    </div>
  )
}
