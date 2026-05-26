import { Link, useLocation, useNavigate } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "../firebase"

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await signOut(auth)
    navigate("/")
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="w-full h-16 flex items-center justify-center border-b border-white/10 bg-black/30 backdrop-blur-xl">

      {/* INNER CONTAINER */}
      <div className="w-full max-w-5xl px-4 flex items-center justify-between">

        {/* LEFT */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/explorar")}
        >
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 group-hover:bg-white/20 transition" />

          <span className="text-white font-medium text-sm tracking-wide">
            NoEmprendasSolo
          </span>
        </div>

        {/* CENTER NAV */}
        <nav className="flex items-center gap-6 text-sm">
          <NavItem to="/explorar" label="Explorar" active={isActive("/explorar")} />
          <NavItem to="/chats" label="Chat" active={isActive("/chats")} />
          <NavItem to="/grupos" label="Grupos" active={isActive("/grupos")} />
          <NavItem to="/workflow" label="Workflow" active={isActive("/workflow")} />
          <NavItem to="/foros" label="Foros" active={isActive("/foros")} />
          <NavItem to="/calendario" label="Calendario" active={isActive("/calendario")} />
          <NavItem to="/perfil" label="Perfil" active={isActive("/perfil")} />
        </nav>

        {/* RIGHT */}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm bg-red-500/70 hover:bg-red-500 rounded-md text-white transition hover:scale-[1.02]"
        >
          Salir
        </button>

      </div>
    </header>
  )
}

/* ---------------- NAV ITEM ---------------- */

function NavItem({
  to,
  label,
  active,
}: {
  to: string
  label: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={`
        relative transition
        ${active ? "text-white" : "text-gray-400 hover:text-white"}
      `}
    >
      {label}

      <span
        className={`
          absolute left-0 -bottom-1 h-[2px] w-full rounded-full transition
          ${active ? "bg-white" : "bg-transparent"}
        `}
      />
    </Link>
  )
}