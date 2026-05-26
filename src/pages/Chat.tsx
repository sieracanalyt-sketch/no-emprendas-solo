import { useEffect, useRef, useState } from "react"
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  getDoc
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "../firebase"
import { useParams } from "react-router-dom"

export default function Chat() {
  const { id: otherUserId } = useParams()
  const [user] = useAuthState(auth)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState("")
  const [otherUser, setOtherUser] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chatId = user ? [user.uid, otherUserId].sort().join("_") : ""

  useEffect(() => {
    if (!otherUserId) return
    const ref = doc(db, "users", otherUserId)
    getDoc(ref).then((snap) => setOtherUser(snap.data()))
  }, [otherUserId])

  useEffect(() => {
    if (!user) return

    const messagesRef = collection(db, "chats", chatId, "messages")
    const q = query(messagesRef, orderBy("timestamp", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data())
      setMessages(list)

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    })

    return () => unsubscribe()
  }, [user, chatId])

  const sendMessage = async () => {
    if (!text.trim()) return

    const messagesRef = collection(db, "chats", chatId, "messages")

    await setDoc(
      doc(db, "chats", chatId),
      { updatedAt: Date.now() },
      { merge: true }
    )

    await addDoc(messagesRef, {
      text,
      from: user!.uid,
      to: otherUserId,
      timestamp: Date.now()
    })

    setText("")
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)

    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="w-full h-[85vh] flex flex-col p-4 bg-black">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-600" />
          <h2 className="text-xl font-bold text-white">
            {otherUser?.name || "Usuario"}
          </h2>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 w-full overflow-y-auto flex flex-col gap-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
        {messages.map((m, i) => {
          const isMe = m.from === user?.uid

          return (
            <div
              key={i}
              className={`flex w-full ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                  isMe
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                <p>{m.text}</p>

                <p className="text-[9px] opacity-60 mt-1 text-right">
                  {formatDateTime(m.timestamp)}
                </p>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="flex gap-2 mt-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2 rounded bg-gray-800 text-white border border-gray-700"
        />

        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Enviar
        </button>
      </div>

    </div>
  )
}