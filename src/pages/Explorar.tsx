import { useEffect, useState } from "react"
import { db, auth } from "../firebase"
import { collection, getDocs } from "firebase/firestore"
import { useNavigate } from "react-router-dom"

type User = {
  id: string
  nombre?: string
  proyecto?: string
  biografia?: string
}

export default function Explorar() {
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const cargarUsuarios = async () => {
      const snap = await getDocs(collection(db, "users"))
      const currentUserId = auth.currentUser?.uid

      const list: User[] = snap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<User, "id">) }))
        .filter((u) => u.id !== currentUserId)

      setUsuarios(list)
      setLoading(false)
    }

    cargarUsuarios()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Explorar</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Encuentra cofundadores y colaboradores
        </p>
      </div>

      {/* STATES */}
      {loading && (
        <p className="text-white/40 text-sm">Cargando usuarios…</p>
      )}

      {!loading && usuarios.length === 0 && (
        <p className="text-white/40 text-sm">No hay usuarios todavía.</p>
      )}

      {/* LIST */}
      {usuarios.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {usuarios.map((u, i) => (
            <div
              key={u.id}
              onClick={() => navigate(`/perfil-publico/${u.id}`)}
              className="flex items-center justify-between gap-4 px-4 py-4 cursor-pointer transition"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
            >
              {/* Avatar + info */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white/50 shrink-0"
                  style={{ background: "rgba(255,255,255,0.09)" }}
                >
                  {(u.nombre || "?")[0].toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h2 className="text-white font-medium text-sm">
                    {u.nombre || "Usuario"}
                  </h2>
                  {u.proyecto && (
                    <p className="text-white/40 text-xs truncate mt-0.5">
                      {u.proyecto}
                    </p>
                  )}
                </div>
              </div>

              {/* Acción */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/chat/${u.id}`)
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.11)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.13)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
                }
              >
                Mensaje
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
