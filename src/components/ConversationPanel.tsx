import { useEffect, useMemo, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { setLastRead } from "../lib/reads"
import { uploadChatMedia, type AttachmentKind, type UploadResult } from "../lib/uploadMedia"
import { useAudioRecorder } from "../hooks/useAudioRecorder"
import Avatar from "./Avatar"
import MessageAttachment, { type Attachment } from "./MessageAttachment"
import { useCalls } from "../calls/CallProvider"
import { deadlineInfo, deadlineColor, fmtTimeLeft } from "../lib/matchDeadline"

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────
export type ConversationTarget =
  | { type: "chat"; otherUserId: string }
  | { type: "group"; groupId: string }

type Msg = {
  id: string
  text: string | null
  from_uid: string
  created_at: string
  attachment_url?: string | null
  attachment_type?: AttachmentKind | null
  attachment_name?: string | null
  attachment_size?: number | null
  duration?: number | null
}

const MSG_COLS =
  "id, text, from_uid, created_at, attachment_url, attachment_type, attachment_name, attachment_size, duration"

type Props = {
  target: ConversationTarget
  user: User
  online: Set<string>
  onActivity?: () => void
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

function attOf(m: Msg): Attachment | null {
  if (!m.attachment_url || !m.attachment_type) return null
  return {
    url: m.attachment_url,
    type: m.attachment_type,
    name: m.attachment_name,
    size: m.attachment_size,
    duration: m.duration,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────────
export default function ConversationPanel({ target, user, online, onActivity, onBack }: Props) {
  const navigate = useNavigate()

  const isGroup = target.type === "group"
  const chatId = useMemo(
    () => (target.type === "chat" ? [user.id, target.otherUserId].sort().join("_") : ""),
    [target, user.id]
  )

  const table = isGroup ? "group_messages" : "messages"
  const filterCol = isGroup ? "group_id" : "chat_id"
  const filterVal = isGroup ? target.groupId : chatId
  const convKey = isGroup ? `group:${target.groupId}` : `chat:${chatId}`

  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { startCall, inCall } = useCalls()

  // Cabecera
  const [headerName, setHeaderName] = useState("")
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(null)
  const [membersCount, setMembersCount] = useState(0)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string | null>>({})

  const recorder = useAudioRecorder()
  const fileRef = useRef<HTMLInputElement>(null)
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
            .select("id, nombre, avatar")
            .in("id", group.members)
          if (cancelled) return
          const names: Record<string, string> = {}
          const avatars: Record<string, string | null> = {}
          for (const u of usersData ?? []) {
            names[u.id] = u.nombre || "Usuario"
            avatars[u.id] = u.avatar ?? null
          }
          setMemberNames(names)
          setMemberAvatars(avatars)
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

    // Dos consultas separadas en vez de una con `table`/`filterCol` variables:
    // con los tipos generados, `.from(union)` deja solo las columnas comunes a
    // las dos tablas y `group_id`/`chat_id` no está en esa intersección.
    const pending = isGroup
      ? supabase
          .from("group_messages")
          .select(MSG_COLS)
          .eq("group_id", filterVal)
          .order("created_at", { ascending: true })
      : supabase
          .from("messages")
          .select(MSG_COLS)
          .eq("chat_id", filterVal)
          .order("created_at", { ascending: true })

    pending
      .then(({ data }) => {
        if (cancelled) return
        const loaded = (data as Msg[]) ?? []
        setMessages(prev => {
          if (prev.length === 0) return loaded
          const ids = new Set(loaded.map(m => m.id))
          const extras = prev.filter(m => !ids.has(m.id))
          return extras.length ? [...loaded, ...extras] : loaded
        })
        scrollToBottom("auto")
        setLastRead(convKey)
        onActivity?.()
      })

    const channel = supabase
      .channel(`conv-${filterVal}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${filterCol}=eq.${filterVal}` },
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

  // ── Inserción genérica (texto y/o adjunto) ───────────────────────────────────
  const insertMessage = async (payload: {
    text: string | null
    attachment?: UploadResult
  }) => {
    const att = payload.attachment
    // Sin anotar como Record<string, unknown>: eso borra las claves concretas
    // y el insert deja de ver `from_uid`, que es obligatorio en las dos tablas.
    const base = {
      text: payload.text,
      from_uid: user.id,
      attachment_url: att?.url ?? null,
      attachment_type: att?.type ?? null,
      attachment_name: att?.name ?? null,
      attachment_size: att?.size ?? null,
      duration: att?.duration ?? null,
    }

    if (target.type === "group") {
      const { data: inserted } = await supabase
        .from("group_messages")
        .insert({ ...base, group_id: target.groupId })
        .select(MSG_COLS)
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
        .insert({ ...base, chat_id: chatId, to_uid: target.otherUserId })
        .select(MSG_COLS)
        .single()
      if (inserted) appendUnique(inserted as Msg)
    }
    scrollToBottom("smooth")
    setLastRead(convKey)
    onActivity?.()
  }

  // ── Enviar texto ──────────────────────────────────────────────────────────────
  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText("")
    requestAnimationFrame(autoGrow)
    try {
      await insertMessage({ text: body })
    } finally {
      setSending(false)
    }
  }

  // ── Enviar adjunto (imagen / archivo / audio) ────────────────────────────────
  const sendAttachment = async (
    blob: Blob,
    meta: { name: string; kind?: AttachmentKind; duration?: number }
  ) => {
    setUploading(true)
    try {
      const up = await uploadChatMedia(blob, {
        userId: user.id,
        name: meta.name,
        kind: meta.kind,
        duration: meta.duration,
      })
      await insertMessage({ text: null, attachment: up })
    } catch (e) {
      console.error(e)
      alert("No se pudo subir el archivo. Inténtalo de nuevo.")
    } finally {
      setUploading(false)
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // permite re-seleccionar el mismo archivo
    if (file) sendAttachment(file, { name: file.name })
  }

  // ── Audio ─────────────────────────────────────────────────────────────────────
  const stopAndSendAudio = async () => {
    const res = await recorder.stop()
    if (res) {
      await sendAttachment(res.blob, {
        name: `nota-de-voz-${Date.now()}.webm`,
        kind: "audio",
        duration: res.duration,
      })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const otherOnline = target.type === "chat" && online.has(target.otherUserId)
  const recording = recorder.state === "recording"

  // ── Iniciar llamada real (voz/vídeo) sobre la conversación abierta ──────────
  const startConversationCall = (video: boolean) => {
    if (target.type === "chat") {
      startCall({
        type: "user",
        video,
        peer: { id: target.otherUserId, nombre: headerName || "Usuario", avatar: headerAvatar },
        chatId,
      })
    } else {
      const memberIds = Object.keys(memberNames)
      if (memberIds.length === 0) return
      startCall({
        type: "group",
        video,
        groupId: target.groupId,
        groupName: headerName || "Grupo",
        memberIds,
      })
    }
  }

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
            className="md:hidden text-xl leading-none -ml-1 pr-1"
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
              style={{ background: "var(--green)", border: "2px solid var(--bg)" }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-t1 font-semibold text-[14px] leading-tight truncate">
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

        {/* Llamadas de voz / vídeo — reales (LiveKit) */}
        <button
          onClick={() => startConversationCall(false)}
          disabled={inCall}
          className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-[15px] btn-linear disabled:opacity-40"
          title="Llamada de voz"
          aria-label="Llamada de voz"
        >
          📞
        </button>
        <button
          onClick={() => startConversationCall(true)}
          disabled={inCall}
          className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-[15px] btn-linear disabled:opacity-40"
          title="Videollamada"
          aria-label="Videollamada"
        >
          🎥
        </button>

        {isGroup && (
          <button
            onClick={() => navigate(`/group/${target.groupId}/info`)}
            className="btn-linear shrink-0 text-[12px] px-3 py-1.5 rounded-md hidden sm:block"
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
          const showSender = isGroup && !isMe && (!prev || prev.from_uid !== m.from_uid)
          const senderName = memberNames[m.from_uid] || "Usuario"
          const att = attOf(m)
          const hasText = !!(m.text && m.text.trim())

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              style={{ marginTop: showSender ? "0.6rem" : 0 }}
            >
              {/* Remitente (avatar + nombre) ENCIMA de la burbuja — minimalista */}
              {showSender && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <Avatar name={senderName} src={memberAvatars[m.from_uid]} size={18} />
                  <span className="text-[11px] font-semibold" style={{ color: colorFor(m.from_uid) }}>
                    {senderName}
                  </span>
                </div>
              )}

              <div
                className="max-w-[78%] flex flex-col gap-1.5"
                style={{ alignItems: isMe ? "flex-end" : "flex-start" }}
              >
                {att && <MessageAttachment att={att} />}

                {(hasText || !att) && (
                  <div
                    className="px-3.5 py-2.5 text-[14px]"
                    style={{
                      background: isMe ? "rgba(var(--accent-rgb), 0.22)" : "var(--surface-3)",
                      color: isMe ? "var(--t1)" : "var(--text)",
                      border: isMe
                        ? "1px solid rgba(194, 84, 47,0.25)"
                        : "1px solid var(--border)",
                      borderRadius: isMe
                        ? "0.75rem 0.75rem 0.25rem 0.75rem"
                        : "0.75rem 0.75rem 0.75rem 0.25rem",
                    }}
                  >
                    {hasText && (
                      <p
                        className="leading-relaxed"
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {m.text}
                      </p>
                    )}
                    <p
                      className="text-[10px] mt-1.5 text-right flex items-center justify-end gap-1"
                      style={{ opacity: 0.5 }}
                    >
                      {formatTime(m.created_at)}
                      {isMe && <span title="Enviado">✓</span>}
                    </p>
                  </div>
                )}

                {/* Hora suelta cuando solo hay adjunto */}
                {att && !hasText && (
                  <span className="text-[10px] px-1" style={{ color: "var(--text-dimmer)" }}>
                    {formatTime(m.created_at)}
                    {isMe && " ✓"}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Deadline social 72 h — solo chats 1:1 con el último mensaje del otro */}
      {(() => {
        if (isGroup || messages.length === 0) return null
        const last = messages[messages.length - 1]
        const dl = deadlineInfo(last.from_uid === user.id, last.created_at)
        if (!dl?.waitingYou) return null
        if (dl.expired) {
          return (
            <div className="px-4 md:px-6 py-2 shrink-0 flex items-center gap-2 text-[12px]"
              style={{ background: "rgba(138,143,152,0.07)", borderTop: "1px solid var(--border)", color: "var(--text-dim)" }}>
              <span>💤</span>
              <span>Este match se enfrió por falta de respuesta — un mensaje lo reactiva. 🔥</span>
            </div>
          )
        }
        const col = deadlineColor(dl.msLeft)
        return (
          <div className="px-4 md:px-6 py-2 shrink-0 flex items-center gap-2 text-[12px]"
            style={{ background: `${col}0f`, borderTop: `1px solid ${col}33`, color: col }}>
            <span>⏳</span>
            <span>
              <strong>{fmtTimeLeft(dl.msLeft)}</strong> para responder — los matches sin respuesta se enfrían y tu velocidad de respuesta alimenta tu prestigio.
            </span>
          </div>
        )
      })()}

      {/* ENTRADA */}
      <div className="px-4 md:px-6 py-3.5 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <input ref={fileRef} type="file" hidden onChange={onPickFile} />

        {recording ? (
          // ── Barra de grabación ──────────────────────────────────────────────
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            style={{ background: "linear-gradient(180deg, rgba(var(--overlay-rgb), 0.07), rgba(var(--overlay-rgb), 0.03))", WebkitBackdropFilter: "blur(18px) saturate(1.3)", backdropFilter: "blur(18px) saturate(1.3)", border: "1px solid var(--glass-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(var(--overlay-rgb), 0.08)" }}
          >
            <button
              onClick={recorder.cancel}
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
              style={{ color: "var(--danger)" }}
              title="Cancelar"
            >
              🗑
            </button>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--danger)", animation: "fadeIn 1s infinite alternate" }} />
            <span className="text-[13px] tabular-nums shrink-0" style={{ color: "var(--text)" }}>
              {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-[2px] flex-1 h-6 overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 2,
                    height: 4 + recorder.level * 20 * (0.4 + ((i * 13) % 7) / 10),
                    background: "var(--accent)",
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
            <button
              onClick={stopAndSendAudio}
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-t1"
              style={{ background: "var(--accent)" }}
              title="Enviar nota de voz"
            >
              ↑
            </button>
          </div>
        ) : (
          // ── Entrada normal ──────────────────────────────────────────────────
          <div
            className="flex items-end gap-2 px-3 py-2 rounded-2xl"
            style={{ background: "linear-gradient(180deg, rgba(var(--overlay-rgb), 0.07), rgba(var(--overlay-rgb), 0.03))", WebkitBackdropFilter: "blur(18px) saturate(1.3)", backdropFilter: "blur(18px) saturate(1.3)", border: "1px solid var(--glass-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(var(--overlay-rgb), 0.08)" }}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-lg transition disabled:opacity-40"
              style={{ color: "var(--text-dim)" }}
              title="Adjuntar imagen o archivo"
            >
              {uploading ? "…" : "📎"}
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
              className="flex-1 min-w-0 bg-transparent text-t1 text-[14px] outline-none resize-none py-1 placeholder:text-[#8f8b7c]"
              style={{ caretColor: "var(--accent-blue)", maxHeight: 140 }}
            />
            {text.trim() ? (
              <button
                onClick={send}
                disabled={sending}
                className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-t1 text-base font-bold transition disabled:opacity-30"
                style={{ background: "var(--accent)" }}
                aria-label="Enviar"
              >
                ↑
              </button>
            ) : (
              <button
                onClick={recorder.start}
                className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-lg transition"
                style={{ color: "var(--text-dim)" }}
                title="Grabar nota de voz"
                aria-label="Grabar nota de voz"
              >
                🎙️
              </button>
            )}
          </div>
        )}
        {recorder.error && (
          <p className="text-[11px] mt-1.5" style={{ color: "var(--danger)" }}>
            {recorder.error}
          </p>
        )}
      </div>

    </div>
  )
}
