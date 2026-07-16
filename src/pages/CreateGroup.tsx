import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useNavigate } from "react-router-dom"

type User = { id: string; nombre?: string }

export default function CreateGroup() {
  const [user] = useUser()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  useEffect(() => {
    supabase.from("users").select("id, nombre").then(({ data, error }) => {
      if (!error) setUsers(data ?? [])
    })
  }, [])

  const toggleUser = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id])
  }

  const createGroup = async () => {
    if (!name.trim() || !user || creating) return
    setCreating(true)
    setCreateError("")
    const { data, error } = await supabase
      .from("groups")
      .insert({ name, description, members: [user.id, ...selected] })
      .select("id")
      .single()
    setCreating(false)
    if (error || !data) { setCreateError("No se pudo crear el grupo. Inténtalo de nuevo."); return }
    navigate(`/group/${data.id}`)
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate("/grupos")}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8 transition-colors"
      >
        ← Grupos
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Crear grupo</h1>
        <p className="text-white/40 text-sm mt-0.5">Configura los detalles y añade miembros</p>
      </div>

      <div
        className="glass rounded-2xl p-6 space-y-5 mb-5"
      >
        <div>
          <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del grupo"
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition placeholder:text-white/25"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">
            Descripción <span className="normal-case text-white/20">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el propósito del grupo…"
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none transition resize-none placeholder:text-white/25"
            style={inputStyle}
          />
        </div>
      </div>

      <div
        className="glass rounded-2xl overflow-hidden mb-5"
      >
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
            Añadir miembros
            {selected.length > 0 && (
              <span className="ml-2 text-white/60 normal-case">
                · {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {users.filter((u) => u.id !== user?.id).map((u, i) => {
            const isSelected = selected.includes(u.id)
            return (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white/50"
                    style={{ background: "rgba(255,255,255,0.09)" }}
                  >
                    {(u.nombre || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-white text-sm">{u.nombre || "Usuario"}</span>
                </div>
                {isSelected && <span className="text-white text-xs">✓</span>}
              </div>
            )
          })}
        </div>
      </div>

      {createError && <p className="text-red-400 text-sm text-center mb-3">{createError}</p>}
      <button
        onClick={createGroup}
        disabled={!name.trim() || creating}
        className="w-full py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition disabled:opacity-30"
      >
        {creating ? "Creando…" : "Crear grupo"}
      </button>
    </div>
  )
}
