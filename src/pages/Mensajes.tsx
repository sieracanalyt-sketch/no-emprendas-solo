import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useLocation, Link } from "react-router-dom"
import { useUser } from "../hooks/useUser"
import { usePresence } from "../hooks/usePresence"
import { useChatList, useGroupList } from "../hooks/useConversations"
import { useNucleo, type Nucleo } from "../hooks/useNucleo"
import { NUCLEO, STAGE_LABEL } from "../lib/config/nucleos"
import { deadlineInfo, deadlineColor, fmtTimeLeft } from "../lib/matchDeadline"
import ConversationPanel, {
  type ConversationTarget,
} from "../components/ConversationPanel"
import Avatar from "../components/Avatar"
import NextMeetingWidget from "../components/NextMeetingWidget"

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
  const { nucleo } = useNucleo(user)

  const [search, setSearch] = useState("")
  // Un núcleo con menos de 4 no abre chat: la fila se pulsa igual y enseña el
  // contador. Estado local porque no es una conversación, no lleva URL.
  const [verNucleo, setVerNucleo] = useState(false)

  // Tic por minuto: mantiene vivos los contadores de 72 h sin recargar
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = window.setInterval(() => setTick((t) => t + 1), 60000)
    return () => window.clearInterval(i)
  }, [])

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

  const hasSelection = target !== null || verNucleo

  if (!user) {
    return (
      <div className="flex items-center justify-center page-viewport">
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className="flex w-full overflow-hidden page-viewport">
      {/* ════════════════ PANEL IZQUIERDO (lista) ════════════════ */}
      <aside
        className={`${
          hasSelection ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-[320px] md:shrink-0 h-full`}
        style={{
          background: "var(--surface-2)",
          WebkitBackdropFilter: "blur(16px)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* NÚCLEO — siempre arriba y siempre visible: lo tiene el 100 % de los
            usuarios y no es una pestaña más. */}
        {nucleo && (
          <NucleoRow
            nucleo={nucleo}
            activo={verNucleo || (target?.type === "group" && target.groupId === nucleo.id)}
            onClick={() => {
              if (nucleo.chatUnlocked) {
                setVerNucleo(false)
                navigate(`/group/${nucleo.id}`)
              } else {
                setVerNucleo(true)
              }
            }}
          />
        )}

        {/* Pestañas compactas (estilo nativo) */}
        <div
          className="flex items-center gap-5 px-4 h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <TabButton
            label="Chats"
            active={tab === "chats" && !verNucleo}
            onClick={() => { setVerNucleo(false); navigate("/chats") }}
          />
          <TabButton
            label="Grupos"
            active={tab === "grupos" && !verNucleo}
            onClick={() => { setVerNucleo(false); navigate("/grupos") }}
          />
        </div>

        {/* Búsqueda */}
        <div className="px-3 py-3 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "chats" ? "Buscar chats…" : "Buscar grupos…"}
            className="field-input w-full px-4 py-2 rounded-full text-[13px]"
          />
        </div>

        {/* Acción crear grupo */}
        {tab === "grupos" && (
          <div className="px-3 pb-2 shrink-0">
            <Link to="/create-group">
              <button className="btn-linear w-full py-2 text-[13px] font-medium rounded-full">
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

        {/* Widget próxima reunión (T1-20) */}
        <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <NextMeetingWidget user={user} />
        </div>
      </aside>

      {/* ════════════════ PANEL CENTRAL (conversación) ════════════════ */}
      <main
        className={`${
          hasSelection ? "flex" : "hidden md:flex"
        } flex-col flex-1 min-w-0 h-full`}
        style={{ background: "var(--bg)" }}
      >
        {verNucleo && nucleo ? (
          <NucleoFormingPanel nucleo={nucleo} onBack={() => setVerNucleo(false)} />
        ) : target ? (
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
// Núcleo
// ──────────────────────────────────────────────────────────────────────────────

/** Punto + texto de estado. Los colores salen de tokens semánticos, nunca hex. */
function estadoNucleo(n: Nucleo): { color: string; texto: string } {
  if (!n.chatUnlocked)
    return { color: "var(--state-forming)", texto: `formándose · ${n.memberCount}/${NUCLEO.MIN_SIZE}` }
  if (n.status === "active")
    return { color: "var(--state-active)", texto: `${n.memberCount} miembros` }
  if (n.status === "at_risk")
    return { color: "var(--state-forming)", texto: `${n.memberCount} miembros` }
  return { color: "var(--state-forming)", texto: `${n.memberCount}/${NUCLEO.MIN_SIZE}` }
}

function NucleoRow({
  nucleo, activo, onClick,
}: { nucleo: Nucleo; activo: boolean; onClick: () => void }) {
  const estado = estadoNucleo(nucleo)
  return (
    <div className="px-3 pt-3 pb-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold tracking-wider px-1 pb-2"
         style={{ color: "var(--t3)" }}>
        NÚCLEO
      </p>
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-[180ms]"
        style={{
          background: activo ? "rgba(var(--accent-rgb), 0.12)" : "var(--surface)",
          border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
        }}
        onMouseEnter={(e) => {
          if (!activo) e.currentTarget.style.borderColor = "var(--border-hover)"
        }}
        onMouseLeave={(e) => {
          if (!activo) e.currentTarget.style.borderColor = "var(--border)"
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: estado.color }} aria-hidden />
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--t1)" }}>
            {nucleo.name}
          </span>
          {!nucleo.chatUnlocked && (
            <span className="ml-auto text-[10px] shrink-0" style={{ color: "var(--state-locked)" }}
                  title="El chat se abre a partir de 4 personas">
              🔒
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5 pl-3.5" style={{ color: "var(--t3)" }}>
          {estado.texto}
          {nucleo.stage && ` · ${STAGE_LABEL[nucleo.stage]}`}
        </p>
      </button>
    </div>
  )
}

/** Lo que se ve al pulsar un núcleo que todavía no tiene chat abierto. */
function NucleoFormingPanel({ nucleo, onBack }: { nucleo: Nucleo; onBack: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const enlace = `${window.location.origin}/register`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-14 shrink-0"
           style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={onBack} className="md:hidden text-[13px]" style={{ color: "var(--t3)" }}>
          ←
        </button>
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--t1)" }}>
          {nucleo.name}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4">
        <div className="w-full max-w-2xl text-center py-10">
          <p className="text-xl font-bold" style={{ color: "var(--t1)" }}>
            Tu núcleo se está formando · {nucleo.memberCount} de {NUCLEO.MIN_SIZE}
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--t2)" }}>
            Cuando lleguéis a {NUCLEO.CHAT_UNLOCK_AT} se abre el chat. Mientras tanto,
            tienes Explorar.
          </p>

          {/* Plazas: llenas frente a libres, sin barra de progreso */}
          <div className="flex items-center justify-center gap-2 mt-7" aria-hidden>
            {Array.from({ length: NUCLEO.MIN_SIZE }).map((_, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: i < nucleo.memberCount ? "var(--state-forming)" : "transparent",
                  border: `1px solid ${i < nucleo.memberCount ? "var(--state-forming)" : "var(--border-hover)"}`,
                }}
              />
            ))}
          </div>

          {nucleo.members.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
              {nucleo.members.map((m) => (
                <span key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--t2)" }}>
                  <Avatar name={m.nombre} src={m.avatar} size={20} />
                  {m.nombre}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <button onClick={copiar}
                    className="btn-linear px-5 py-2.5 text-[13px] font-medium rounded-full">
              {copiado ? "Enlace copiado" : "Invitar a alguien"}
            </button>
            <Link to="/explorar"
                  className="px-5 py-2.5 text-[13px] rounded-full transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--t2)" }}>
              Ir a Explorar
            </Link>
          </div>

          <p className="text-[11px] mt-4" style={{ color: "var(--t3)" }}>
            Invitar es lo único que acelera esto: llena tu núcleo antes.
          </p>
        </div>
      </div>
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
      {items.map((c) => {
        // Deadline social 72 h: chip de cuenta atrás / match enfriado
        const dl = deadlineInfo(c.lastFromMe, c.timestamp)
        let badge: React.ReactNode = null
        if (dl?.waitingYou && !dl.expired) {
          const col = deadlineColor(dl.msLeft)
          badge = (
            <span
              className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${col}1c`, color: col, border: `1px solid ${col}44` }}
              title="Tiempo restante para responder — los matches sin respuesta se enfrían"
            >
              ⏳ {fmtTimeLeft(dl.msLeft)}
            </span>
          )
        } else if (dl?.expired) {
          badge = (
            <span
              className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(138,143,152,0.12)", color: "var(--text-dimmer)", border: "1px solid var(--border)" }}
              title={dl.waitingYou ? "Se acabó el tiempo de respuesta — un mensaje lo reactiva" : "No respondió a tiempo"}
            >
              💤 {dl.waitingYou ? "enfriado" : "sin respuesta"}
            </span>
          )
        }
        return (
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
            badge={badge}
          />
        )
      })}
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
  badge,
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
  badge?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition w-full"
      style={{ background: active ? "rgba(var(--overlay-rgb), 0.06)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.background = "rgba(var(--overlay-rgb), 0.03)"
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
            style={{ background: "var(--green)", border: "2px solid var(--surface-2)" }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-[14px] ${
              unread > 0 ? "text-t1 font-semibold" : "text-t1 font-medium"
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
          {badge}
          {unread > 0 && (
            <span
              className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-black"
              style={{ background: "var(--green)" }}
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
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: "linear-gradient(180deg, rgba(194, 84, 47,0.16), rgba(194, 84, 47,0.05))",
          border: "1px solid rgba(194, 84, 47,0.28)",
          color: "var(--accent-2)",
          boxShadow: "0 8px 24px rgba(194, 84, 47,0.18), inset 0 1px 0 rgba(var(--overlay-rgb), 0.08)",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.5A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
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
