import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { Link } from "react-router-dom"

type GroupItem = { id: string; name: string; members: number; lastMessage: string }

export default function Grupos() {
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGroups = async () => {
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, members")

      if (!groupsData) { setLoading(false); return }

      const list: GroupItem[] = []

      for (const g of groupsData) {
        const { data: lastMsgs } = await supabase
          .from("group_messages")
          .select("text")
          .eq("group_id", g.id)
          .order("created_at", { ascending: false })
          .limit(1)

        list.push({
          id: g.id,
          name: g.name,
          members: g.members?.length ?? 0,
          lastMessage: lastMsgs?.[0]?.text ?? "Sin mensajes aún",
        })
      }

      setGroups(list)
      setLoading(false)
    }

    loadGroups()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Grupos</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {loading ? "Cargando…" : `${groups.length} grupos disponibles`}
          </p>
        </div>
        <Link to="/create-group">
          <button className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition">
            Crear grupo
          </button>
        </Link>
      </div>

      {!loading && groups.length === 0 && (
        <p className="text-white/40 text-sm">No hay grupos todavía.</p>
      )}

      {groups.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {groups.map((g, i) => (
            <Link
              key={g.id}
              to={`/group/${g.id}`}
              className="flex items-center justify-between gap-4 px-4 py-4 transition"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold text-white/50 shrink-0"
                  style={{ background: "rgba(255,255,255,0.09)" }}
                >
                  {(g.name || "G")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm">{g.name}</p>
                  <p className="text-white/40 text-xs truncate mt-0.5">{g.lastMessage}</p>
                </div>
              </div>
              <span className="text-white/25 text-xs shrink-0">
                {g.members} miembro{g.members !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
