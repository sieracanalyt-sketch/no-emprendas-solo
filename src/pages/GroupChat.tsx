import { useEffect, useRef, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useParams, useNavigate } from "react-router-dom"

type Message = {
  id: string
  text: string
  from_uid: string
  created_at: string
}

export default function GroupChat() {
  const { id } = useParams()
  const groupId = id as string
  const [user] = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [groupInfo, setGroupInfo] = useState<{ name: string; members: string[] } | null>(null)
  const [membersInfo, setMembersInfo] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!groupId) return
    const load = async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, members")
        .eq("id", groupId)
        .single()

      if (!group) return
      setGroupInfo(group)

      const names: Record<string, string> = {}
      for (const uid of group.members) {
        const { data: u } = await supabase.from("users").select("nombre").eq("id", uid).single()
        names[uid] = u?.nombre || "Usuario"
      }
      setMembersInfo(names)
    }
    load()
  }, [groupId])

  useEffect(() => {
    if (!user || !groupId) return

    // Load existing messages
    supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, groupId])

  const sendMessage = async () => {
    if (!text.trim() || !user) return
    await supabase.from("group_messages").insert({
      group_id: groupId,
      text,
      from_uid: user.id,
    })
    await supabase.from("groups").update({ updated_at: new Date().toISOString() }).eq("id", groupId)
    setText("")
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <div className="flex flex-col max-w-3xl mx-auto" style={{ height: "calc(100vh - 3.5rem)" }}>
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
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Menú
        </button>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-4 py-4">
        {messages.map((m) => {
          const isMe = m.from_uid === user?.id
          const senderName = membersInfo[m.from_uid] || "Usuario"
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[72%] px-4 py-2.5 text-sm"
                style={{
                  background: isMe ? "white" : "rgba(255,255,255,0.07)",
                  color: isMe ? "#09090b" : "white",
                  borderRadius: isMe ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                }}
              >
                {!isMe && (
                  <p className="text-[11px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {senderName}
                  </p>
                )}
                <p className="leading-relaxed">{m.text}</p>
                <p className="text-[10px] mt-1 text-right" style={{ opacity: 0.4 }}>
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje…"
            className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none"
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
