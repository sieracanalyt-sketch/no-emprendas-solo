import { useEffect, useMemo, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { setLastRead } from "../lib/reads"
import Avatar from "./Avatar"

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────
export type ConversationTarget =
  | { type: "chat"; otherUserId: string }
  | { type: "group"; groupId: string }

type Msg = {
  id: string
  text: string
  from_uid: string
  created_at: string
}

type Props = {
  target: ConversationTarget
  user: User
  online: Set<string>
  /** Se invoca al abrir/recibir/enviar para refrescar las listas (no leídos, orden) */
  onActivity?: () => void
  /** Volver a la lista (solo visible en móvil) */
  onBack?: () => void
}

// Paleta de colores para nombres de remitentes en grupos (estilo Discord)
const PALETTE = [
  "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4dd0e1", "#4db6ac",
  "#81c784", "#aed581", "#ffd54f", "#ffb74d",
]

function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────────
export default function ConversationPanel({
  target,
  user,
  online,
  onActivity,
  onBack,
}: Props) {
  const navigate = useNavigate()

  const isGroup = target.type === "group"
  const chatId = useMemo(
    () =>
      target.type === "chat"
        ? [user.id, target.otherUserId].sort().join("_")
        : "",
    [target, user.id]
  )

  const table = isGroup ? "group_messages" : "messages"
  const filterCol = isGroup ? "group_id" : "chat_id"
  const filterVal = isGroup ? target.groupId : chatId
  const convKey = isGroup ? `group:${target.groupId}` : `chat:${chatId}`

  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  // Cabecera (chat: otro usuario | grupo: nombre + miembros)
  const [headerName, setHeaderName] = useState("")
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(null)
  const [membersCount, setMembersCount] = useState(0)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior }), 40)

  const appendUnique = (m: Msg) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))

  // ── Cargar cabecera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const loadHeader = async () => {
      if (target.type === "chat") {
        const { data } = await supabase
          .from("users")
          .select("nombre, avatar")
          .eq("id", target.otherUserId)
          .single()
        if (cancelled) return
        setHeaderName(data?.nombre || "Usuario")
        setHeaderAvatar(data?.avatar ?? null)
      } else {
        const { data: group } = await supabase
          .from("groups")
          .select("name, members")
          .eq("id", target.groupId)
          .single()
        if (cancelled || !group) return
        setHeaderName(group.name || "Grupo")
        setMembersCount(group.members?.length ?? 0)

        if (group.members?.length) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, nombre")
            .in("id", group.members)
          if (cancelled) return
          const map: Record<string, string> = {}
          for (const u of usersData ?? []) map[u.id] = u.nombre || "Usuario"
          setMemberNames(map)
        }
      }
    }
    loadHeader()
    return () => {
      cancelled = true
    }
  }, [target])

  // ── Cargar mensajes + realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!filterVal) return
    let cancelled = false

    supabase
      .from(table)
      .select("id, text, from_uid, created_at")
      .eq(filterCol, filterVal)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setMessages((data as Msg[]) ?? [])
        scrollToBottom("auto")
        setLastRead(convKey)
        onActivity?.()
      })

    const channel = supabase
      .channel(`conv-${filterVal}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${filterCol}=eq.${filterVal}`,
        },
        (payload) => {
          appendUnique(payload.new as Msg)
          scrollToBottom("smooth")
          setLastRead(convKey)
          onActivity?.()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVal, table, filterCol, convKey])

  // ── Textarea auto-crecimiento ───────────────────────────────────────────────
  const autoGrow = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 140) + "px"
  }

  useEffect(() => {
    if (text === "") autoGrow()
  }, [text])

  // ── Enviar ──────────────────────────────────────────────────────────────────
  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText("")
    requestAnimationFrame(autoGrow)

    try {
      if (target.type === "group") {
        const { data: inserted } = await supabase
          .from("group_messages")
          .insert({ group_id: target.groupId, text: body, from_uid: user.id })
          .select("id, text, from_uid, created_at")
          .single()
        if (inserted) appendUnique(inserted as Msg)
        await supabase
          .from("groups")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", target.groupId)
      } else {
        const sorted = [user.id, target.otherUserId].sort()
        await supabase.from("chats").upsert({
          id: chatId,
          user1_id: sorted[0],
          user2_id: sorted[1],
          updated_at: new Date().toISOString(),
        })
        const { data: inserted } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            text: body,
            from_uid: user.id,
            to_uid: target.otherUserId,
          })
          .select("id, text, from_uid, created_at")
          .single()
        if (inserted) appendUnique(inserted as Msg)
      }
      scrollToBottom("smooth")
      setLastRead(convKey)
      onActivity?.()
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const otherOnline =
    target.type === "chat" && online.has(target.otherUserId)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-w-0">
      {/* CABECERA */}
      <div
        className="flex items-center gap-3 px-4 h-14 shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(21, 22, 24, 0.4)",
          backdropFilter: "blur(8px)",
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden text-xl leading-none -ml-1 pr-1 transition-colors"
            style={{ color: "var(--text-dim)" }}
            aria-label="Volver"
          >
            ←
          </button>
        )}

        <div className="relative shrink-0">
          <Avatar name={headerName} src={headerAvatar} size={36} group={isGroup} />
          {target.type === "chat" && otherOnline && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
              style={{ background: "#22c55e", border: "2px solid var(--bg)" }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-[14px] leading-tight truncate">
            {headerName || (isGroup ? "Grupo" : "Usuario")}
          </p>
          <p className="text-[12px] leading-tight mt-0.5" style={{ color: "var(--text-dim)" }}>
            {isGroup
              ? `${membersCount} miembro${membersCount !== 1 ? "s" : ""}`
              : otherOnline
              ? "En línea"
              : "Desconectado"}
          </p>
        </div>

        {isGroup && (
          <button
            onClick={() => navigate(`/group/${target.groupId}/info`)}
            className="btn-linear shrink-0 text-[12px] px-3 py-1.5 rounded-md"
          >
            Opciones
          </button>
        )}
      </div>

      {/* MENSAJES */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-4 md:px-6 py-5">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px]" style={{ color: "var(--text-dimmer)" }}>
              No hay mensajes todavía. ¡Escribe el primero!
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = m.from_uid === user.id
          const prev = messages[i - 1]
          const showSender =
            isGroup && !isMe && (!prev || prev.from_uid !== m.from_uid)
          const senderName = memberNames[m.from_uid] || "Usuario"

          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              style={{ marginTop: showSender ? "0.5rem" : 0 }}
            >
              <div
                className="max-w-[72%] px-3.5 py-2.5 text-[14px]"
                style={{
                  background: isMe ? "#2f3346" : "var(--surface-3)",
                  color: isMe ? "#f0f1f5" : "var(--text)",
                  border: isMe
                    ? "1px solid rgba(94,106,210,0.25)"
                    : "1px solid var(--border)",
                  borderRadius: isMe
                    ? "0.75rem 0.75rem 0.25rem 0.75rem"
                    : "0.75rem 0.75rem 0.75rem 0.25rem",
                }}
              >
                {showSender && (
                  <p
                    className="text-[11px] font-semibold mb-1"
                    style={{ color: colorFor(m.from_uid) }}
                  >
                    {senderName}
                  </p>
                )}
                <p
                  className="leading-relaxed"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {m.text}
                </p>
                <p
                  className="text-[10px] mt-1.5 text-right flex items-center justify-end gap-1"
                  style={{ opacity: 0.5 }}
                >
                  {formatTime(m.created_at)}
                  {isMe && <span title="Enviado">✓</span>}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ENTRADA */}
      <div
        className="px-4 md:px-6 py-3.5 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-lg"
          style={{
            background: "#080710",
            border: "1px solid var(--border-strong)",
          }}
        >
          <button
            type="button"
            className="shrink-0 text-lg leading-none pb-1 transition-colors"
            style={{ color: "var(--text-dimmer)" }}
            title="Adjuntar (próximamente)"
            tabIndex={-1}
          >
            +
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              autoGrow()
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="flex-1 min-w-0 bg-transparent text-white text-[14px] outline-none resize-none py-1 placeholder:text-[#62666d]"
            style={{ caretColor: "var(--accent-blue)", maxHeight: 140 }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white text-base font-bold transition disabled:opacity-30"
            style={{ background: "var(--accent)" }}
            aria-label="Enviar"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
