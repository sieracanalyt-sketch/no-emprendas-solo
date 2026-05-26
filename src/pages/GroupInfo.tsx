import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { db } from "../firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "../firebase"

export default function GroupInfo() {
  const { id } = useParams()
  const groupId = id as string
  const [user] = useAuthState(auth)
  const [groupInfo, setGroupInfo] = useState<any>(null)
  const [newName, setNewName] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const ref = doc(db, "groups", groupId, "info", "data")
      const snap = await getDoc(ref)
      setGroupInfo(snap.data())
      setNewName(snap.data()?.name || "")
    }
    load()
  }, [groupId])

  const changeName = async () => {
    if (!newName.trim()) return
    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { name: newName })
    alert("Nombre actualizado")
  }

  const removeMember = async (uid: string) => {
    if (!groupInfo) return

    const newMembers = groupInfo.members.filter((m: string) => m !== uid)

    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { members: newMembers })

    setGroupInfo({ ...groupInfo, members: newMembers })
  }

  const leaveGroup = async () => {
    if (!groupInfo) return

    const newMembers = groupInfo.members.filter((m: string) => m !== user?.uid)

    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { members: newMembers })

    navigate("/mensajes")
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Información del grupo</h1>

      {groupInfo && (
        <>
          {/* Cambiar nombre */}
          <div className="mb-6">
            <p className="text-gray-400 text-sm">Nombre del grupo</p>
            <input
              className="w-full p-2 bg-gray-800 rounded mt-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              onClick={changeName}
              className="mt-2 px-3 py-2 bg-blue-600 rounded"
            >
              Guardar nombre
            </button>
          </div>

          {/* Miembros */}
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-2">Miembros</p>
            <div className="flex flex-col gap-2">
              {groupInfo.members.map((m: string) => (
                <div key={m} className="bg-gray-800 p-2 rounded flex justify-between items-center">
                  <span>{m}</span>

                  {m !== user?.uid && (
                    <button
                      onClick={() => removeMember(m)}
                      className="px-2 py-1 bg-red-600 rounded text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate(`/group/${groupId}/add-members`)}
              className="mt-4 px-3 py-2 bg-green-600 rounded"
            >
              Añadir miembros
            </button>

            {/* ⭐ Salir del grupo */}
            <button
              onClick={leaveGroup}
              className="mt-4 px-3 py-2 bg-red-600 rounded"
            >
              Salir del grupo
            </button>
          </div>
        </>
      )}
    </div>
  )
}
