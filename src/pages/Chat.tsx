import { useEffect, useRef, useState } from "react"
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth } from "../firebase"
import { useParams, useNavigate } from "react-router-dom"

export default function Chat() {
  const { id: otherUserId } = useParams()
  const [user] = useAuthState(auth)
  const [messages, setMessages] = useState<{ text: string; from: string; to?: string; timestamp: number }[]>([])
  const [text, setText] = useState("")
  const [otherUser, setOtherUser] = useState<{ nombre?: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const chatId = user ? [user.uid, otherUserId].sort().join("_") : ""

  useEffect(() => {
    if (!otherUserId) return
    getDoc(doc(db, "users", otherUserId)).then((snap) => setOtherUser(snap.data()))
  }, [otherUserId])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    )
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => d.data()))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    })
  }, [user, chatId])

  const sendMessage = async () => {
    if (!text.trim()) return
    await setDoc(doc(db, "chats", chatId), { updatedAt: Date.now() }, { merge: true })
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      from: user!.uid,
      to: otherUserId,
      timestamp: Date.now(),
    })
    setText("")
  }

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })

  const initial = (otherUser?.nombre || "?")[0].toUpperCase()

  return (
    <div
      className="flex flex-col max-w-3xl mx-auto"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* HEADER */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => navigate("/chats")}
          className="text-white/40 hover:text-white transition-colors text-lg leading-none"
        >
          ←
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white/60 shrink-0"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          {initial}
        </div>

        <span className="text-white font-medium text-sm">
          {otherUser?.nombre || "Usuario"}
        </span>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-4 py-4">
        {messages.map((m, i) => {
          const isMe = m.from === user?.uid

          return (
            <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[72%] px-4 py-2.5 text-sm"
                style={{
                  background: isMe ? "white" : "rgba(255,255,255,0.07)",
                  color: isMe ? "#09090b" : "white",
                  borderRadius: isMe
                    ? "1rem 1rem 0.25rem 1rem"
                    : "1rem 1rem 1rem 0.25rem",
                }}
              >
                <p className="leading-relaxed">{m.text}</p>
                <p
                  className="text-[10px] mt-1 text-right"
                  style={{ opacity: 0.4 }}
                >
                  {formatTime(m.timestamp)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje…"
            className="flex-1 bg-transparent text-white text-sm outline-none"
            style={{ caretColor: "white" }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim()}
            className="text-white/40 hover:text-white disabled:opacity-20 transition-colors text-base leading-none"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
