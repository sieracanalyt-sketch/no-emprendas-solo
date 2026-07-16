import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../supabase"

export default function AddMembers() {
  const { id } = useParams()
  const groupId = id as string
  const navigate = useNavigate()

  const [users, setUsers] = useState<{ id: string; nombre?: string }[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [currentMembers, setCurrentMembers] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("members")
        .eq("id", groupId)
        .single()
      setCurrentMembers(group?.members ?? [])

      const { data: allUsers } = await supabase.from("users").select("id, nombre")
      setUsers(allUsers ?? [])
    }
    load()
  }, [groupId])

  const toggle = (uid: string) => {
    if (currentMembers.includes(uid)) return
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    )
  }

  const addMembers = async () => {
    if (selected.length === 0 || adding) return
    setAdding(true)
    await supabase
      .from("groups")
      .update({ members: [...currentMembers, ...selected] })
      .eq("id", groupId)
    navigate(`/group/${groupId}/info`)
  }

  const available = users.filter((u) => !currentMembers.includes(u.id))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(`/group/${groupId}/info`)}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8 transition-colors"
      >
        ← Volver
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Añadir miembros</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {selected.length > 0
            ? `${selected.length} seleccionado${selected.length !== 1 ? "s" : ""}`
            : "Selecciona las personas a añadir"}
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-white/40 text-sm">Todos los usuarios ya son miembros.</p>
      ) : (
        <div className="glass rounded-2xl overflow-hidden mb-5">
          {available.map((u, i) => {
            const isSelected = selected.includes(u.id)
            return (
              <div
                key={u.id}
                onClick={() => toggle(u.id)}
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white/50"
                    style={{ background: "rgba(255,255,255,0.09)" }}
                  >
                    {(u.nombre || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{u.nombre || "Usuario"}</span>
                </div>
                {isSelected && <span className="text-white text-xs font-medium">✓</span>}
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={addMembers}
        disabled={selected.length === 0 || adding}
        className="w-full py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition disabled:opacity-30"
      >
        {adding ? "Añadiendo…" : "Añadir al grupo"}
      </button>
    </div>
  )
}
