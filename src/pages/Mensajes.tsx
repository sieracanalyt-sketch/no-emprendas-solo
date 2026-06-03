import { useMemo, useState } from "react"
import { useNavigate, useParams, useLocation, Link } from "react-router-dom"
import { useUser } from "../hooks/useUser"
import { usePresence } from "../hooks/usePresence"
import { useChatList, useGroupList } from "../hooks/useConversations"
import ConversationPanel, {
  type ConversationTarget,
} from "../components/ConversationPanel"
import Avatar from "../components/Avatar"

type Tab = "chats" | "grupos"

// Hora corta para la lista (hoy → hora, ayer, etc.)
function listTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
    return "ayer"

  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
}

export default function Mensajes() {
  const [user] = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const online = usePresence(user)
  const { items: chats, loading: loadingChats, refresh: refreshChats } =
    useChatList(user)
  const { items: groups, loading: loadingGroups, refresh: refreshGroups } =
    useGroupList(user)

  const [search, setSearch] = useState("")

  // ── Derivar pestaña activa y selección desde la URL ─────────────────────────
  const segment = location.pathname.split("/")[1] // chats | chat | grupos | group
  const tab: Tab = segment === "grupos" || segment === "group" ? "grupos" : "chats"

  const target: ConversationTarget | null = useMemo(() => {
    if (segment === "chat" && id) return { type: "chat", otherUserId: id }
    if (segment === "group" && id) return { type: "group", groupId: id }
    return null
  }, [segment, id])

  const refreshLists = () => {
    refreshChats()
    refreshGroups()
  }

  // ── Filtrado por búsqueda ───────────────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filteredChats = chats.filter((c) => c.name.toLowerCase().includes(q))
  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(q))

  const hasSelection = target !== null

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando…</p>
      </div>
    )
  }

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* ════════════════ PANEL IZQUIERDO (lista) ════════════════ */}
      <aside
        className={`${
          hasSelection ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-[320px] md:shrink-0 h-full`}
        style={{
          background: "var(--surface-2)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Pestañas compactas (estilo nativo) */}
        <div
          className="flex items-center gap-5 px-4 h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <TabButton
            label="Chats"
            active={tab === "chats"}
            onClick={() => navigate("/chats")}
          />
          <TabButton
            label="Grupos"
            active={tab === "grupos"}
            onClick={() => navigate("/grupos")}
          />
        </div>

        {/* Búsqueda */}
        <div className="px-3 py-3 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "chats" ? "Buscar chats…" : "Buscar grupos…"}
            className="field-input w-full px-3.5 py-2 rounded-md text-[13px]"
          />
        </div>

        {/* Acción crear grupo */}
        {tab === "grupos" && (
          <div className="px-3 pb-2 shrink-0">
            <Link to="/create-group">
              <button className="btn-linear w-full py-2 text-[13px] font-medium rounded-md">
                + Crear grupo
              </button>
            </Link>
          </div>
        )}

        {/* Lista con scroll independiente */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-3">
          {tab === "chats" ? (
            <ChatList
              loading={loadingChats}
              items={filteredChats}
              onlineSet={online}
              activeId={target?.type === "chat" ? target.otherUserId : null}
              onSelect={(otherUserId) => navigate(`/chat/${otherUserId}`)}
            />
          ) : (
            <GroupList
              loading={loadingGroups}
              items={filteredGroups}
              activeId={target?.type === "group" ? target.groupId : null}
              onSelect={(groupId) => navigate(`/group/${groupId}`)}
            />
          )}
        </div>
      </aside>

      {/* ════════════════ PANEL CENTRAL (conversación) ════════════════ */}
      <main
        className={`${
          hasSelection ? "flex" : "hidden md:flex"
        } flex-col flex-1 min-w-0 h-full`}
        style={{ background: "var(--bg)" }}
      >
        {target ? (
          <ConversationPanel
            key={`${target.type}-${
              target.type === "chat" ? target.otherUserId : target.groupId
            }`}
            target={target}
            user={user}
            online={online}
            onActivity={refreshLists}
            onBack={() => navigate(tab === "grupos" ? "/grupos" : "/chats")}
          />
        ) : (
          <EmptyState tab={tab} />
        )}
      </main>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────────────────────────────────────
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative h-12 text-[13px] font-medium transition-colors"
      style={{ color: active ? "var(--text)" : "var(--text-dim)" }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text)"
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text-dim)"
      }}
    >
      {label}
      {active && (
        <span
          className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full"
          style={{ background: "var(--text)" }}
        />
      )}
    </button>
  )
}

function ChatList({
  loading,
  items,
  onlineSet,
  activeId,
  onSelect,
}: {
  loading: boolean
  items: ReturnType<typeof useChatList>["items"]
  onlineSet: Set<string>
  activeId: string | null
  onSelect: (otherUserId: string) => void
}) {
  if (loading)
    return <p className="text-[13px] px-3 py-6 text-center" style={{ color: "var(--text-dimmer)" }}>Cargando…</p>
  if (items.length === 0)
    return (
      <p className="text-[13px] px-3 py-6 text-center" style={{ color: "var(--text-dimmer)" }}>
        No tienes chats todavía
      </p>
    )

  return (
    <div className="flex flex-col">
      {items.map((c) => (
        <Row
          key={c.chatId}
          active={activeId === c.otherUserId}
          onClick={() => onSelect(c.otherUserId)}
          avatar={<Avatar name={c.name} src={c.avatar} size={42} />}
          online={onlineSet.has(c.otherUserId)}
          name={c.name}
          text={c.lastText}
          time={listTime(c.timestamp)}
          unread={c.unread}
        />
      ))}
    </div>
  )
}

function GroupList({
  loading,
  items,
  activeId,
  onSelect,
}: {
  loading: boolean
  items: ReturnType<typeof useGroupList>["items"]
  activeId: string | null
  onSelect: (groupId: string) => void
}) {
  if (loading)
    return <p className="text-[13px] px-3 py-6 text-center" style={{ color: "var(--text-dimmer)" }}>Cargando…</p>
  if (items.length === 0)
    return (
      <p className="text-[13px] px-3 py-6 text-center" style={{ color: "var(--text-dimmer)" }}>
        No perteneces a ningún grupo
      </p>
    )

  return (
    <div className="flex flex-col">
      {items.map((g) => (
        <Row
          key={g.id}
          active={activeId === g.id}
          onClick={() => onSelect(g.id)}
          avatar={<Avatar name={g.name} size={42} group />}
          name={g.name}
          text={g.lastText}
          time={listTime(g.timestamp)}
          unread={g.unread}
          subtitle={`${g.membersCount} miembro${g.membersCount !== 1 ? "s" : ""}`}
        />
      ))}
    </div>
  )
}

function Row({
  active,
  onClick,
  avatar,
  online,
  name,
  text,
  time,
  unread,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  avatar: React.ReactNode
  online?: boolean
  name: string
  text: string
  time: string
  unread: number
  subtitle?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-2.5 py-2.5 rounded-md text-left transition w-full"
      style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.background = "rgba(255,255,255,0.03)"
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent"
      }}
    >
      <div className="relative shrink-0">
        {avatar}
        {online && (
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
            style={{ background: "#22c55e", border: "2px solid var(--surface-2)" }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-[14px] ${
              unread > 0 ? "text-white font-semibold" : "text-white font-medium"
            }`}
          >
            {name}
          </p>
          <span className="text-[11px] shrink-0" style={{ color: "var(--text-dimmer)" }}>{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className="truncate text-[12px]"
            style={{ color: unread > 0 ? "var(--text-dim)" : "var(--text-dimmer)" }}
          >
            {subtitle ? subtitle : text || "—"}
          </p>
          {unread > 0 && (
            <span
              className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-black"
              style={{ background: "#22c55e" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        💬
      </div>
      <p className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
        {tab === "chats" ? "Tus mensajes" : "Tus grupos"}
      </p>
      <p className="text-[12px] mt-1 max-w-xs" style={{ color: "var(--text-dimmer)" }}>
        Selecciona {tab === "chats" ? "un chat" : "un grupo"} de la lista para
        empezar a conversar
      </p>
    </div>
  )
}
