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
import { useParams, Link } from "react-router-dom"

export default function GroupChat() {
  const { id } = useParams()
  const groupId = id as string

  const [user] = useAuthState(auth)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState("")
  const [groupInfo, setGroupInfo] = useState<any>(null)
  const [membersInfo, setMembersInfo] = useState<any>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!groupId) return

    const load = async () => {
      const ref = doc(db, "groups", groupId, "info", "data")
      const snap = await getDoc(ref)
      const info = snap.data()

      if (!info) return

      setGroupInfo(info)

      const membersData: any = {}

      for (const uid of info.members) {
        const userRef = doc(db, "users", uid)
        const userSnap = await getDoc(userRef)
        membersData[uid] = userSnap.data()?.nombre || "Usuario"
      }

      setMembersInfo(membersData)
    }

    load()
  }, [groupId])

  useEffect(() => {
    if (!user || !groupId) return

    const messagesRef = collection(db, "groups", groupId, "messages")
    const q = query(messagesRef, orderBy("timestamp", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data())
      setMessages(list)

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    })

    return () => unsubscribe()
  }, [user, groupId])

  const sendMessage = async () => {
    if (!text.trim()) return

    const messagesRef = collection(db, "groups", groupId, "messages")

    await setDoc(doc(db, "groups", groupId), {
      updatedAt: Date.now()
    }, { merge: true })

    await addDoc(messagesRef, {
      text,
      from: user!.uid,
      timestamp: Date.now()
    })

    setText("")
  }

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("es-ES", {
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
        <div>
          <h2 className="text-xl font-bold text-white">
            {groupInfo?.name || "Grupo"}
          </h2>
          <p className="text-gray-400 text-sm">
            {groupInfo?.members?.length || 0} miembros
          </p>
        </div>

        <Link to={`/group/${groupId}/info`}>
          <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
            Menú
          </button>
        </Link>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
        {messages.map((m, i) => {
          const isMe = m.from === user?.uid

          return (
            <div
              key={i}
              className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                  isMe
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >

                {!isMe && (
                  <p className="text-xs text-gray-300 mb-1">
                    {membersInfo[m.from] || "Usuario"}
                  </p>
                )}

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