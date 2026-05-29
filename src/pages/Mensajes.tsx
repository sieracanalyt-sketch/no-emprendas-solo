import { useEffect, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useNavigate } from "react-router-dom"

type ChatItem = {
  chatId: string
  otherUserId: string
  name: string
  text: string
  timestamp: string
}

export default function Mensajes() {
  const [user] = useUser()
  const [items, setItems] = useState<ChatItem[]>([])
  const navigate = useNavigate()

  function formatearFecha(iso: string) {
    const fecha = new Date(iso)
    const hoy = new Date()

    const esMismoDia =
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()

    if (esMismoDia) return fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const ayer = new Date()
    ayer.setDate(hoy.getDate() - 1)
    const esAyer =
      fecha.getDate() === ayer.getDate() &&
      fecha.getMonth() === ayer.getMonth() &&
      fecha.getFullYear() === ayer.getFullYear()
    if (esAyer) return "ayer"

    const diff = hoy.getTime() - fecha.getTime()
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (dias <= 7) return `hace ${dias} días`

    return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
  }

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const { data: chats } = await supabase
        .from("chats")
        .select("id, user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

      if (!chats) return

      const finalList: ChatItem[] = []

      for (const chat of chats) {
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("text, created_at")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1)

        if (!lastMsgs || lastMsgs.length === 0) continue

        const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id
        const { data: otherUser } = await supabase
          .from("users")
          .select("nombre")
          .eq("id", otherUserId)
          .single()

        finalList.push({
          chatId: chat.id,
          otherUserId,
          name: otherUser?.nombre || "Usuario",
          text: lastMsgs[0].text,
          timestamp: lastMsgs[0].created_at,
        })
      }

      finalList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setItems(finalList)
    }

    fetchAll()
  }, [user])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Tus chats</h2>
      </div>

      {items.length === 0 && (
        <p className="text-gray-400">No tienes chats todavía</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((c) => (
          <div
            key={c.chatId}
            onClick={() => navigate(`/chat/${c.otherUserId}`)}
            className="group bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition flex items-center justify-between gap-4"
          >
            <div className="flex flex-col min-w-0">
              <p className="text-white font-semibold text-lg leading-tight">{c.name}</p>
              <p className="text-gray-400 text-sm mt-1 leading-snug line-clamp-1">{c.text}</p>
            </div>
            <p className="text-gray-500 text-[11px] shrink-0 mt-1">
              {formatearFecha(c.timestamp)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
