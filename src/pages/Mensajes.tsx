import { useEffect, useState } from "react"
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore"
import { db, auth } from "../firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { useNavigate } from "react-router-dom"

type ChatItem = {
  id: string
  name: string
  text: string
  timestamp: number
}

export default function Mensajes() {
  const [user] = useAuthState(auth)
  const [items, setItems] = useState<ChatItem[]>([])
  const navigate = useNavigate()

  function formatearFecha(timestamp: number) {
    const fecha = new Date(timestamp)
    const hoy = new Date()

    const esMismoDia =
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()

    if (esMismoDia) {
      return fecha.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    }

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

    return fecha.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short"
    })
  }

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const finalList: ChatItem[] = []

      const chatsRef = collection(db, "chats")
      const chatsSnap = await getDocs(chatsRef)

      for (const docSnap of chatsSnap.docs) {
        const chatId = docSnap.id
        const [uid1, uid2] = chatId.split("_")

        if (uid1 !== user.uid && uid2 !== user.uid) continue

        const messagesRef = collection(docSnap.ref, "messages")
        const q = query(messagesRef, orderBy("timestamp", "desc"), limit(1))
        const lastSnap = await getDocs(q)

        if (!lastSnap.empty) {
          const lastMessage = lastSnap.docs[0].data()

          const otherUserId = uid1 === user.uid ? uid2 : uid1
          const otherUserRef = doc(db, "users", otherUserId)
          const otherUserSnap = await getDoc(otherUserRef)

          finalList.push({
            id: chatId,
            name: otherUserSnap.data()?.nombre || "Usuario",
            text: lastMessage.text,
            timestamp: lastMessage.timestamp
          })
        }
      }

      finalList.sort((a, b) => b.timestamp - a.timestamp)
      setItems(finalList)
    }

    fetchAll()
  }, [user])

  const openItem = (item: ChatItem) => {
    const [uid1, uid2] = item.id.split("_")
    const otherUser = uid1 === user!.uid ? uid2 : uid1
    navigate(`/chat/${otherUser}`)
  }

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
            key={c.id}
            onClick={() => openItem(c)}
            className="
              group
              bg-white/5
              border border-white/10
              rounded-xl
              p-4
              cursor-pointer
              hover:bg-white/10
              transition
              flex
              items-center
              justify-between
              gap-4
            "
          >

            {/* LEFT: INFO */}
            <div className="flex flex-col min-w-0">

              {/* NOMBRE (GRANDE) */}
              <p className="text-white font-semibold text-lg leading-tight">
                {c.name}
              </p>

              {/* MENSAJE (MEDIANO) */}
              <p className="text-gray-400 text-sm mt-1 leading-snug line-clamp-1">
                {c.text}
              </p>

            </div>

            {/* RIGHT: FECHA (PEQUEÑA) */}
            <p className="text-gray-500 text-[11px] shrink-0 mt-1">
              {formatearFecha(c.timestamp)}
            </p>

          </div>
        ))}
      </div>

    </div>
  )
}