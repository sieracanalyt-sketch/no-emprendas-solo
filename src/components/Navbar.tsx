import { Link, useLocation, useNavigate } from "react-router-dom"
import { supabase } from "../supabase"

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const isActive = (path: string) =>
    path === "/explorar"
      ? location.pathname === path
      : location.pathname.startsWith(path)

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(9, 9, 11, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="w-full max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-8">

        {/* LOGO */}
        <button
          onClick={() => navigate("/explorar")}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-black"
            style={{ background: "white" }}
          >
            N
          </div>
          <span className="text-white text-sm font-semibold tracking-tight">
            NoEmprendasSolo
          </span>
        </button>

        {/* CENTER NAV */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          <NavItem to="/explorar" label="Explorar" active={isActive("/explorar")} />
          <NavItem to="/chats" label="Mensajes" active={isActive("/chats") || isActive("/chat")} />
          <NavItem to="/grupos" label="Grupos" active={isActive("/grupos") || isActive("/group")} />
          <NavItem to="/workflow" label="Workflow" active={isActive("/workflow")} />
          <NavItem to="/foros" label="Foros" active={isActive("/foros")} />
          <NavItem to="/calendario" label="Calendario" active={isActive("/calendario")} />
          <NavItem to="/perfil" label="Perfil" active={isActive("/perfil")} />
        </nav>

        {/* RIGHT */}
        <button
          onClick={handleLogout}
          className="shrink-0 px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-all"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"
          }}
        >
          Salir
        </button>

      </div>
    </header>
  )
}

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className="relative px-3 py-1.5 text-sm rounded-md transition-all"
      style={{
        color: active ? "white" : "rgba(255,255,255,0.5)",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)"
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)"
      }}
    >
      {label}
    </Link>
  )
}
