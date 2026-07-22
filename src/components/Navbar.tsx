import { Link, useLocation, useNavigate } from "react-router-dom"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { supabase } from "../supabase"
import { useUserTier } from "../hooks/useUserTier"
import { BrandMark } from "./AuthLayout"

// Iconos de línea propios (nada de emoji): trazo consistente, look de producto.
const ic = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const
function IcExplorar() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
}
function IcMensajes() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1.4-4.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
}
function IcWorkflow() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></svg>
}
function IcCalendario() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
}
function IcPerfil() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
}
function IcMerge() {
  return <svg width="21" height="21" viewBox="0 0 24 24" {...ic}><path d="M7 4v4a5 5 0 0 0 5 5 5 5 0 0 1 5 5v2M17 4v4a5 5 0 0 1-5 5" /><path d="m14 17 3 3 3-3" /></svg>
}

type Item = {
  to: string
  label: string
  icon: ReactNode
  tour?: string
  active: boolean
  accent?: boolean
  premium?: boolean
}

// Mide el ítem activo dentro de un "rail" y devuelve la posición/anchura de la
// lente de cristal líquido que se desliza hasta él (ver design.md §3).
// Re-mide en: cambio de activo, resize y cuando las fuentes terminan de cargar
// (Inter puede ensanchar las etiquetas y descolocar la lente).
function useLens(items: Item[], deps: unknown[]) {
  const railRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const [lens, setLens] = useState({ left: 0, width: 0, visible: false, accent: false })
  const activeIndex = items.findIndex((i) => i.active)

  useLayoutEffect(() => {
    const measure = () => {
      const idx = items.findIndex((i) => i.active)
      const el = itemRefs.current[idx]
      if (idx < 0 || !el) {
        setLens((l) => ({ ...l, visible: false }))
        return
      }
      setLens({ left: el.offsetLeft, width: el.offsetWidth, visible: true, accent: !!items[idx].accent })
    }
    measure()
    // segunda pasada tras el layout de fuentes
    const raf = requestAnimationFrame(measure)
    if (document.fonts?.ready) void document.fonts.ready.then(measure)
    window.addEventListener("resize", measure)

    // El rail puede encogerse/ensancharse sin que cambien activeIndex ni la
    // ruta (p.ej. el badge "Admin" aparece tras cargar isAdmin de forma
    // asíncrona y le quita espacio al rail): sin este observer la lente se
    // queda con la posición vieja, colgada entre dos ítems.
    const ro = new ResizeObserver(measure)
    if (railRef.current) ro.observe(railRef.current)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, ...deps])

  const setItemRef = (i: number) => (el: HTMLElement | null) => {
    itemRefs.current[i] = el
  }
  return { railRef, setItemRef, lens }
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  // El enlace a /admin solo se pinta para admins. Es cosmético: la seguridad
  // real está en Admin.tsx (guard) y sobre todo en las Edge Functions, que
  // comprueban users.is_admin con el service role antes de hacer nada.
  const { isAdmin } = useUserTier()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate("/")
  }

  const isActive = (path: string) =>
    path === "/explorar"
      ? location.pathname === path
      : location.pathname.startsWith(path)

  // Ítems principales — MERGE incluido para que la lente también viaje hasta él.
  const items: Item[] = [
    { to: "/explorar", label: "Explorar", icon: <IcExplorar />, tour: "explorar", active: isActive("/explorar") },
    { to: "/chats", label: "Mensajes", icon: <IcMensajes />, tour: "mensajes",
      active: isActive("/chats") || isActive("/chat") || isActive("/grupos") || isActive("/group") },
    { to: "/workflow", label: "Workflow", icon: <IcWorkflow />, tour: "workflow", active: isActive("/workflow") },
    { to: "/calendario", label: "Calendario", icon: <IcCalendario />, tour: "calendario", active: isActive("/calendario") },
    { to: "/perfil", label: "Perfil", icon: <IcPerfil />, tour: "perfil", active: isActive("/perfil") },
    { to: "/merge", label: "MERGE", icon: <IcMerge />, active: isActive("/merge"), accent: true, premium: true },
  ]

  const desktop = useLens(items, [location.pathname])
  const mobile = useLens(items, [location.pathname])

  return (
    <>
      <header className="sticky top-3 z-50 w-full px-3 sm:px-5">
        {/* píldora de cristal flotante: la navegación "flota" sobre el contenido */}
        <div className="glass glass-pill w-full max-w-6xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3 sm:gap-6">

          {/* LOGO */}
          <button
            onClick={() => navigate("/explorar")}
            className="flex items-center gap-2.5 shrink-0"
          >
            <BrandMark size={24} />
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#f7f8f8" }}>
              <span className="hidden sm:inline">NoEmprendasSolo</span>
              <span className="inline sm:hidden">NES</span>
            </span>
          </button>

          {/* CENTER NAV — solo desktop; la lente líquida marca el activo */}
          <nav
            ref={(el) => { desktop.railRef.current = el }}
            className="lg-rail hidden md:flex items-center gap-0.5 flex-1 justify-center"
          >
            <span
              aria-hidden
              className={`lg-lens ${desktop.lens.accent ? "lg-accent" : ""} ${desktop.lens.visible ? "" : "lg-hidden"}`}
              style={{ left: desktop.lens.left, width: desktop.lens.width }}
            />
            {items.map((it, i) => (
              <NavItem
                key={it.to}
                innerRef={desktop.setItemRef(i)}
                to={it.to}
                label={it.label}
                active={it.active}
                tour={it.tour}
                accent={it.accent}
                premium={it.premium}
              />
            ))}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{
                  color: location.pathname.startsWith("/admin") ? "#fff" : "#9aa4f0",
                  background: "rgba(94,106,210,0.16)",
                  border: "1px solid rgba(94,106,210,0.30)",
                }}
                title="Panel de administración"
              >
                Admin
              </Link>
            )}
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

      {/* TAB BAR MÓVIL — fija abajo, con la misma lente líquida (solo < md) */}
      <nav
        ref={(el) => { mobile.railRef.current = el }}
        className="bottomnav lg-rail md:hidden"
        aria-label="Navegación principal"
      >
        <span
          aria-hidden
          className={`lg-lens lg-lens-tab ${mobile.lens.accent ? "lg-accent" : ""} ${mobile.lens.visible ? "" : "lg-hidden"}`}
          style={{ left: mobile.lens.left, width: mobile.lens.width }}
        />
        {items.map((it, i) => (
          <Link
            key={it.to}
            ref={mobile.setItemRef(i)}
            to={it.to}
            className={`bottomnav-item ${it.active ? "active" : ""}`}
            style={it.accent && !it.active ? { color: "#8f98e8" } : undefined}
            aria-current={it.active ? "page" : undefined}
          >
            <span className="bn-icon" aria-hidden>{it.icon}</span>
            {it.label}
          </Link>
        ))}
      </nav>
    </>
  )
}

function NavItem({
  innerRef, to, label, active, tour, accent, premium,
}: {
  innerRef?: (el: HTMLElement | null) => void
  to: string
  label: string
  active: boolean
  tour?: string
  accent?: boolean
  premium?: boolean
}) {
  return (
    <Link
      ref={innerRef}
      to={to}
      data-tour={tour}
      className="nav-link relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-full"
      style={{
        color: active ? "#f7f8f8" : accent ? "#9aa4f0" : undefined,
        fontWeight: active || accent ? 500 : 400,
        letterSpacing: accent ? "0.02em" : undefined,
      }}
    >
      {label}
      {premium && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{ background: "rgba(94,106,210,0.18)", color: "#9aa4f0" }}
        >
          Premium
        </span>
      )}
    </Link>
  )
}
