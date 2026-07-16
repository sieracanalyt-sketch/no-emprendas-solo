import { Link, useLocation, useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { useUserTier } from "../hooks/useUserTier"

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useUserTier()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const isActive = (path: string) =>
    path === "/explorar"
      ? location.pathname === path
      : location.pathname.startsWith(path)

  // Ítems principales (desktop: píldora central · móvil: tab bar inferior)
  const items = [
    { to: "/explorar",   label: "Explorar",   icon: "🧭", tour: "explorar",
      active: isActive("/explorar") },
    { to: "/chats",      label: "Mensajes",   icon: "💬", tour: "mensajes",
      active: isActive("/chats") || isActive("/chat") || isActive("/grupos") || isActive("/group") },
    { to: "/workflow",   label: "Workflow",   icon: "📋", tour: "workflow",
      active: isActive("/workflow") },
    { to: "/calendario", label: "Calendario", icon: "🗓", tour: "calendario",
      active: isActive("/calendario") },
    { to: "/perfil",     label: "Perfil",     icon: "👤", tour: "perfil",
      active: isActive("/perfil") },
  ]

  return (
    <>
      <header className="sticky top-3 z-50 w-full px-3 sm:px-5">
        {/* píldora de cristal flotante: la navegación "flota" sobre el contenido */}
        <div
          className="glass glass-pill w-full max-w-6xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3 sm:gap-6"
        >

          {/* LOGO */}
          <button
            onClick={() => navigate("/explorar")}
            className="flex items-center gap-2.5 shrink-0"
          >
            <div
              className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-xs font-bold text-black"
              style={{
                background: "linear-gradient(180deg, #ffffff, #d8d9dc)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            >
              N
            </div>
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "#f7f8f8" }}
            >
              <span className="hidden sm:inline">NoEmprendasSolo</span>
              <span className="inline sm:hidden">NES</span>
            </span>
          </button>

          {/* CENTER NAV — solo desktop; en móvil vive en la tab bar inferior */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {items.map(it => (
              <NavItem key={it.to} to={it.to} label={it.label} active={it.active} tour={it.tour} />
            ))}
            {isAdmin && <NavItem to="/merge" label="MERGE" active={isActive("/merge")} accent />}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("nes:tour"))}
              className="tour-help-btn"
              title="Ver tutorial"
              aria-label="Ver tutorial"
            >
              ?
            </button>
            <button
              onClick={handleLogout}
              className="btn-linear px-3.5 sm:px-4 py-1.5 text-[13px] font-medium rounded-full"
            >
              Salir
            </button>
          </div>

        </div>
      </header>

      {/* TAB BAR MÓVIL — fija abajo, con safe-area (solo < md) */}
      <nav className="bottomnav md:hidden" aria-label="Navegación principal">
        {items.map(it => (
          <Link
            key={it.to}
            to={it.to}
            className={`bottomnav-item ${it.active ? "active" : ""}`}
            aria-current={it.active ? "page" : undefined}
          >
            <span className="bn-icon" aria-hidden>{it.icon}</span>
            {it.label}
            <span className="bn-dot" aria-hidden />
          </Link>
        ))}
        {isAdmin && (
          <Link
            to="/merge"
            className={`bottomnav-item ${isActive("/merge") ? "active" : ""}`}
            style={{ color: isActive("/merge") ? "#fff" : "#5e6ad2" }}
          >
            <span className="bn-icon" aria-hidden>◆</span>
            MERGE
            <span className="bn-dot" aria-hidden />
          </Link>
        )}
      </nav>
    </>
  )
}

function NavItem({ to, label, active, tour, accent }: { to: string; label: string; active: boolean; tour?: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      data-tour={tour}
      className="nav-link relative px-3 py-1.5 text-[13px] rounded-full"
      style={{
        color: active ? "#f7f8f8" : accent ? "#5e6ad2" : undefined,
        background: active ? (accent ? "rgba(94,106,210,0.14)" : "rgba(255,255,255,0.06)") : "transparent",
        fontWeight: active || accent ? 500 : 400,
        letterSpacing: accent ? "0.02em" : undefined,
      }}
    >
      {label}
    </Link>
  )
}
