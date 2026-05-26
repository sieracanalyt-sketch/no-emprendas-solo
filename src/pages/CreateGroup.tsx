import { useEffect, useState } from "react"
import { db } from "../firebase"
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs
} from "firebase/firestore"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "../firebase"
import { useNavigate } from "react-router-dom"

type User = {
  id: string
  nombre?: string
}

export default function CreateGroup() {
  const [user] = useAuthState(auth)
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<string[]>([])

  // 🔥 Cargar usuarios
  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"))

      const list: User[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any)
      }))

      setUsers(list)
    }

    fetchUsers()
  }, [])

  const toggleUser = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((u) => u !== id)
        : [...prev, id]
    )
  }

  const createGroup = async () => {
    if (!name.trim()) return

    const groupRef = await addDoc(collection(db, "groups"), {
      updatedAt: Date.now()
    })

    await setDoc(doc(db, "groups", groupRef.id, "info", "data"), {
      name,
      description,
      members: [user!.uid, ...selected]
    })

    navigate(`/group/${groupRef.id}`)
  }

  return (
    <div className="p-6 text-white max-w-2xl mx-auto">

      <h1 className="text-2xl font-bold mb-6">Crear grupo</h1>

      {/* NAME */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del grupo"
        className="w-full p-3 mb-4 bg-gray-800 rounded border border-gray-700"
      />

      {/* DESCRIPTION */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción"
        className="w-full p-3 mb-4 bg-gray-800 rounded border border-gray-700 h-28"
      />

      {/* USERS */}
      <h2 className="text-lg font-semibold mb-2">
        Añadir miembros
      </h2>

      <div className="bg-gray-900 border border-gray-700 rounded p-3 max-h-60 overflow-y-auto mb-4">
        {users
          .filter((u) => u.id !== user?.uid)
          .map((u) => (
            <div
              key={u.id}
              onClick={() => toggleUser(u.id)}
              className={`
                flex justify-between items-center p-2 rounded cursor-pointer
                hover:bg-gray-800 transition
                ${selected.includes(u.id) ? "bg-blue-600/30" : ""}
              `}
            >
              <span>{u.nombre || "Usuario"}</span>

              {selected.includes(u.id) && (
                <span className="text-blue-400 text-sm">✓</span>
              )}
            </div>
          ))}
      </div>

      {/* BUTTON */}
      <button
        onClick={createGroup}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
      >
        Crear grupo
      </button>

    </div>
  )
}