import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { db } from "../firebase"
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore"

export default function AddMembers() {
  const { id } = useParams()
  const groupId = id as string
  const navigate = useNavigate()

  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [currentMembers, setCurrentMembers] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      // Cargar info del grupo
      const infoRef = doc(db, "groups", groupId, "info", "data")
      const infoSnap = await getDoc(infoRef)
      setCurrentMembers(infoSnap.data()?.members || [])

      // Cargar todos los usuarios
      const snap = await getDocs(collection(db, "users"))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(list)
    }

    load()
  }, [groupId])

  const toggle = (uid: string) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    )
  }

  const addMembers = async () => {
    const newMembers = [...currentMembers, ...selected]

    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { members: newMembers })

    navigate(`/group/${groupId}/info`)
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Añadir miembros</h1>

      <div className="flex flex-col gap-2">
        {users.map(u => (
          <div
            key={u.id}
            onClick={() => toggle(u.id)}
            className={`p-2 rounded cursor-pointer ${
              selected.includes(u.id)
                ? "bg-blue-600"
                : currentMembers.includes(u.id)
                ? "bg-gray-700 opacity-50"
                : "bg-gray-800"
            }`}
          >
            {u.nombre || u.name || "Usuario"}
          </div>
        ))}
      </div>

      <button
        onClick={addMembers}
        className="mt-4 w-full bg-green-600 p-2 rounded"
      >
        Añadir al grupo
      </button>
    </div>
  )
}
