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
  const [groupInfo, setGroupInfo] = useState<{ name: string; members: string[] } | null>(null)
  const [newName, setNewName] = useState("")
  const [membersNames, setMembersNames] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const ref = doc(db, "groups", groupId, "info", "data")
      const snap = await getDoc(ref)
      const info = snap.data()
      setGroupInfo(info)
      setNewName(info?.name || "")

      // Cargar nombres reales de cada miembro
      if (info?.members) {
        const names: Record<string, string> = {}
        for (const uid of info.members) {
          const userRef = doc(db, "users", uid)
          const userSnap = await getDoc(userRef)
          names[uid] = userSnap.data()?.nombre || "Usuario"
        }
        setMembersNames(names)
      }
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
    const confirmed = window.confirm(
      `¿Eliminar a ${membersNames[uid] || "este usuario"} del grupo?`
    )
    if (!confirmed) return
    const newMembers = groupInfo.members.filter((m: string) => m !== uid)
    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { members: newMembers })
    setGroupInfo({ ...groupInfo, members: newMembers })
  }

  const leaveGroup = async () => {
    if (!groupInfo) return
    const confirmed = window.confirm("¿Seguro que quieres salir del grupo?")
    if (!confirmed) return
    const newMembers = groupInfo.members.filter((m: string) => m !== user?.uid)
    const ref = doc(db, "groups", groupId, "info", "data")
    await updateDoc(ref, { members: newMembers })
    navigate("/grupos")
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* BACK */}
      <button
        onClick={() => navigate(`/group/${groupId}`)}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8 transition-colors"
      >
        ← Volver al chat
      </button>

      <h1 className="text-2xl font-bold text-white mb-8">Información del grupo</h1>

      {groupInfo && (
        <div className="space-y-5">

          {/* NOMBRE DEL GRUPO */}
          <section
            className="rounded-xl border border-white/[0.08] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="px-5 pt-4 pb-1">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Nombre del grupo
              </p>
            </div>
            <div className="flex gap-3 px-5 pb-4 pt-2">
              <input
                className="flex-1 px-4 py-2.5 rounded-lg text-white text-sm outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && changeName()}
              />
              <button
                onClick={changeName}
                className="px-4 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition shrink-0"
              >
                Guardar
              </button>
            </div>
          </section>

          {/* MIEMBROS */}
          <section
            className="rounded-xl border border-white/[0.08] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Miembros · {groupInfo.members.length}
              </p>
              <button
                onClick={() => navigate(`/group/${groupId}/add-members`)}
                className="text-white/40 hover:text-white text-xs transition-colors"
              >
                + Añadir
              </button>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {groupInfo.members.map((uid: string) => {
                const name = membersNames[uid]
                const initial = name ? name[0].toUpperCase() : "?"
                const isCurrentUser = uid === user?.uid

                return (
                  <div key={uid} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white/60"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      >
                        {initial}
                      </div>

                      {/* Nombre */}
                      <div>
                        <p className="text-white text-sm font-medium leading-tight">
                          {name || "Cargando…"}
                        </p>
                        {isCurrentUser && (
                          <p className="text-white/30 text-[11px]">Tú</p>
                        )}
                      </div>
                    </div>

                    {!isCurrentUser && (
                      <button
                        onClick={() => removeMember(uid)}
                        className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* SALIR DEL GRUPO */}
          <button
            onClick={leaveGroup}
            className="w-full py-3 text-sm font-medium rounded-xl transition"
            style={{
              color: "rgb(248 113 113)",
              background: "rgba(239, 68, 68, 0.07)",
              border: "1px solid rgba(239, 68, 68, 0.14)",
            }}
          >
            Salir del grupo
          </button>

        </div>
      )}
    </div>
  )
}
