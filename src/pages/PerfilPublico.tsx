import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../supabase"

type UserData = {
  nombre?: string
  biografia?: string
  proyecto?: string
  buscando?: string[]
}

export default function PerfilPublico() {
  const { id } = useParams()
  const [userData, setUserData] = useState<UserData | null>(null)

  useEffect(() => {
    let cancelled = false
    const cargar = async () => {
      const { data } = await supabase
        .from("users")
        .select("nombre, biografia, proyecto, buscando")
        .eq("id", id)
        .single()
      if (!cancelled && data) setUserData(data)
    }
    setUserData(null)
    cargar()
    return () => { cancelled = true }
  }, [id])

  if (!userData)
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-t1/40 text-sm">Cargando…</p>
      </div>
    )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-in">
      <div className="flex items-center gap-5 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-t1/70 shrink-0"
          style={{ background: "rgba(var(--overlay-rgb), 0.1)" }}
        >
          {userData.nombre?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-t1">
            {userData.nombre || "Usuario"}
          </h1>
        </div>
      </div>

      <div
        className="glass rounded-2xl divide-y overflow-hidden"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <InfoRow label="Biografía" value={userData.biografia || "Sin biografía"} />
        <InfoRow label="Proyecto" value={userData.proyecto || "Sin proyecto"} />

        <div className="px-5 py-4">
          <p className="text-[11px] font-medium text-t1/40 uppercase tracking-wider mb-3">
            Busca
          </p>
          {userData.buscando && userData.buscando.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userData.buscando.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs text-t1 px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(var(--overlay-rgb), 0.1)",
                    border: "1px solid rgba(var(--overlay-rgb), 0.12)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-t1/30 text-sm">No ha especificado nada</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium text-t1/40 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-t1/80 text-sm leading-relaxed">{value}</p>
    </div>
  )
}
