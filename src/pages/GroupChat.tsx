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

export default function GroupChat() {
  const { id } = useParams()
  const groupId = id as string
  const [user] = useAuthState(auth)
  const [messages, setMessages] = useState<{ text: string; from: string; timestamp: number }[]>([])
  const [text, setText] = useState("")
  const [groupInfo, setGroupInfo] = useState<{ name: string; members: string[] } | null>(null)
  const [membersInfo, setMembersInfo] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!groupId) return
    const load = async () => {
      const snap = await getDoc(doc(db, "groups", groupId, "info", "data"))
      const info = snap.data()
      if (!info) return
      setGroupInfo(info)
      const names: Record<string, string> = {}
      for (const uid of info.members) {
        const userSnap = await getDoc(doc(db, "users", uid))
        names[uid] = userSnap.data()?.nombre || "Usuario"
      }
      setMembersInfo(names)
    }
    load()
  }, [groupId])

  useEffect(() => {
    if (!user || !groupId) return
    const q = query(
      collection(db, "groups", groupId, "messages"),
      orderBy("timestamp", "asc")
    )
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => d.data()))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    })
  }, [user, groupId])

  const sendMessage = async () => {
    if (!text.trim()) return
    await setDoc(doc(db, "groups", groupId), { updatedAt: Date.now() }, { merge: true })
    await addDoc(collection(db, "groups", groupId, "messages"), {
      text,
      from: user!.uid,
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

  return (
    <div
      className="flex flex-col max-w-3xl mx-auto"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* HEADER */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/grupos")}
            className="text-white/40 hover:text-white transition-colors text-lg leading-none"
          >
            ←
          </button>

          <div>
            <p className="text-white font-medium text-sm leading-tight">
              {groupInfo?.name || "Grupo"}
            </p>
            <p className="text-white/30 text-xs">
              {groupInfo?.members?.length || 0} miembros
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/group/${groupId}/info`)}
          className="text-white/40 hover:text-white text-xs transition-colors px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Menú
        </button>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-4 py-4">
        {messages.map((m, i) => {
          const isMe = m.from === user?.uid
          const senderName = membersInfo[m.from] || "Usuario"

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
                {!isMe && (
                  <p
                    className="text-[11px] font-medium mb-1"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {senderName}
                  </p>
                )}

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
