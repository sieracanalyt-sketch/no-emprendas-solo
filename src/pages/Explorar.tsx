import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useNavigate } from "react-router-dom"

type User = {
  id: string
  nombre?: string
  proyecto?: string
  biografia?: string
}

export default function Explorar() {
  const [user] = useUser()
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const cargarUsuarios = async () => {
      const { data } = await supabase
        .from("users")
        .select("id, nombre, proyecto, biografia")
        .neq("id", user.id)
      setUsuarios(data ?? [])
      setLoading(false)
    }
    cargarUsuarios()
  }, [user])

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 animate-in">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">
          Explorar
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Encuentra cofundadores y colaboradores
        </p>
      </div>

      {loading && (
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
          Cargando usuarios…
        </p>
      )}
      {!loading && usuarios.length === 0 && (
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
          No hay usuarios todavía.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div
            key={u.id}
            onClick={() => navigate(`/perfil-publico/${u.id}`)}
            className="row-card group flex items-center justify-between gap-4 px-4 py-3.5 rounded-md cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-dim)",
                }}
              >
                {(u.nombre || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-medium text-[14px] leading-tight">
                  {u.nombre || "Usuario"}
                </h2>
                <p
                  className="text-[12px] truncate mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  {u.proyecto || u.biografia || "Sin proyecto"}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/chat/${u.id}`)
              }}
              className="btn-linear shrink-0 px-3.5 py-1.5 text-[12px] font-medium rounded-md"
            >
              Mensaje
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
