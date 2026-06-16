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
      className="sticky top-0 z-50 w-full h-14"
      style={{
        background: "rgba(21, 22, 24, 0.72)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="w-full max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-6">

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
            NoEmprendasSolo
          </span>
        </button>

        {/* CENTER NAV */}
        <nav className="flex items-center gap-0.5 flex-1 justify-center">
          <NavItem to="/explorar" label="Explorar" active={isActive("/explorar")} tour="explorar" />
          {/* "Grupos" vive ahora dentro de Mensajes (pestaña interna): se elimina
              de la navbar superior para evitar redundancia. */}
          <NavItem
            to="/chats"
            label="Mensajes"
            active={isActive("/chats") || isActive("/chat") || isActive("/grupos") || isActive("/group")}
            tour="mensajes"
          />
          <NavItem to="/workflow" label="Workflow" active={isActive("/workflow")} tour="workflow" />
          <NavItem to="/calendario" label="Calendario" active={isActive("/calendario")} tour="calendario" />
          <NavItem to="/perfil" label="Perfil" active={isActive("/perfil")} tour="perfil" />
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
            className="btn-linear px-3.5 py-1.5 text-[13px] font-medium rounded-md"
          >
            Salir
          </button>
        </div>

      </div>
    </header>
  )
}

function NavItem({ to, label, active, tour }: { to: string; label: string; active: boolean; tour?: string }) {
  return (
    <Link
      to={to}
      data-tour={tour}
      className="nav-link relative px-2.5 py-1.5 text-[13px] rounded-md"
      style={{
        color: active ? "#f7f8f8" : undefined,
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </Link>
  )
}
