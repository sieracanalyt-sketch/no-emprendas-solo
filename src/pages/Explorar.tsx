import { useEffect, useState } from "react"
import { db, auth } from "../firebase"
import { collection, getDocs } from "firebase/firestore"
import { useNavigate } from "react-router-dom"

type User = {
  id: string
  nombre?: string
  email?: string
}

export default function Explorar() {
  const [usuarios, setUsuarios] = useState<User[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const cargarUsuarios = async () => {
      const snap = await getDocs(collection(db, "users"))

      const currentUserId = auth.currentUser?.uid

      const list: User[] = snap.docs
        .map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<User, "id">),
        }))
        .filter(user => user.id !== currentUserId)

      setUsuarios(list)
    }

    cargarUsuarios()
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 px-4">

      {/* HEADER */}
      <h1 className="text-3xl font-bold mb-8">
        Explorar usuarios
      </h1>

      {/* LISTA */}
      <div className="flex flex-col gap-4">
        {usuarios.length === 0 ? (
          <p className="text-gray-400">Cargando usuarios...</p>
        ) : (
          usuarios.map(user => (
            <div
              key={user.id}
              onClick={() => navigate(`/perfil-publico/${user.id}`)}
              className="bg-[#111] border border-white/10 rounded-xl p-5 flex items-center justify-between hover:bg-[#1a1a1a] transition cursor-pointer"
            >

              {/* INFO */}
              <div>
                <h2 className="text-lg font-semibold">
                  {user.nombre || "Usuario"}
                </h2>

                <p className="text-gray-400 text-sm">
                  {user.email}
                </p>
              </div>

              {/* BOTÓN */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/chat/${user.id}`)
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium"
              >
                Mensaje
              </button>

            </div>
          ))
        )}
      </div>
    </div>
  )
}