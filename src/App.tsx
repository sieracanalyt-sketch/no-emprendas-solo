import { useEffect, lazy, Suspense } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"
import OnboardingTour from "./components/OnboardingTour"
import RequireAuth from "./components/RequireAuth"
import CallProvider from "./calls/CallProvider"
import { supabase } from "./supabase"
import { saveUser } from "./lib/saveUser"

import Login from "./pages/Login"
import Register from "./pages/Register"
import Explorar from "./pages/Explorar"
import Perfil from "./pages/Perfil"
import CompletarPerfil from "./pages/CompletarPerfil"
import Mensajes from "./pages/Mensajes"
import PerfilPublico from "./pages/PerfilPublico"
import Workflow from "./pages/Workflow"
import Calendario from "./pages/Calendario"
import CreateGroup from "./pages/CreateGroup"
import GroupInfo from "./pages/GroupInfo"
import AddMembers from "./pages/AddMembers"
import Admin from "./pages/Admin"
import ConexionAvanzada from "./pages/ConexionAvanzada"
// MERGE arrastra livekit-client (~500 kB): carga diferida para no pesar en el
// bundle principal de los usuarios normales (solo admin lo abre).
const Merge = lazy(() => import("./pages/Jarvis"))

export default function App() {
  const location = useLocation()
  const hideNavbar =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register"

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        // ⚠️ NO usar await ni llamadas a supabase directamente aquí: el callback
        // corre mientras el SDK retiene su lock de auth, y cualquier query que
        // necesite el token espera ese mismo lock → deadlock que congela TODAS
        // las peticiones de la app (en todas las pestañas). setTimeout difiere
        // el trabajo fuera del lock, como recomienda la doc de Supabase.
        const user = session.user
        setTimeout(() => { void saveUser(user) }, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="w-full min-h-screen bg-canvas text-t1">
      <CallProvider>
      {!hideNavbar && <div className="app-aurora" aria-hidden />}
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <OnboardingTour />}
      <div className={hideNavbar ? "w-full" : "w-full app-content"}>
        <Routes>
          {/* Login accesible tanto en "/" como en "/login" para enlaces
              entrantes desde la landing externa (nes-landing). */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Todo lo de abajo exige sesión: sin ella, RequireAuth manda a /login */}
          <Route path="/explorar" element={<RequireAuth><Explorar /></RequireAuth>} />
          <Route path="/conexion-avanzada" element={<RequireAuth><ConexionAvanzada /></RequireAuth>} />
          <Route path="/merge" element={<RequireAuth><Suspense fallback={null}><Merge /></Suspense></RequireAuth>} />
          <Route path="/perfil" element={<RequireAuth><Perfil /></RequireAuth>} />
          <Route path="/perfil-publico/:id" element={<RequireAuth><PerfilPublico /></RequireAuth>} />
          <Route path="/completar-perfil" element={<RequireAuth><CompletarPerfil /></RequireAuth>} />

          {/* Hub de mensajería unificado (Chats + Grupos) */}
          <Route path="/chats" element={<RequireAuth><Mensajes /></RequireAuth>} />
          <Route path="/chat/:id" element={<RequireAuth><Mensajes /></RequireAuth>} />
          <Route path="/grupos" element={<RequireAuth><Mensajes /></RequireAuth>} />
          <Route path="/group/:id" element={<RequireAuth><Mensajes /></RequireAuth>} />

          {/* Páginas de gestión de grupos */}
          <Route path="/create-group" element={<RequireAuth><CreateGroup /></RequireAuth>} />
          <Route path="/group/:id/info" element={<RequireAuth><GroupInfo /></RequireAuth>} />
          <Route path="/group/:id/add-members" element={<RequireAuth><AddMembers /></RequireAuth>} />

          <Route path="/workflow" element={<RequireAuth><Workflow /></RequireAuth>} />
          <Route path="/calendario" element={<RequireAuth><Calendario /></RequireAuth>} />

          {/* Panel de administración (sesión + users.is_admin, ver Admin.tsx) */}
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />

          {/* Cualquier otra ruta: al login (o a /explorar si ya hay sesión) */}
          <Route path="*" element={<RequireAuth><Navigate to="/explorar" replace /></RequireAuth>} />
        </Routes>
      </div>
      </CallProvider>
    </div>
  )
}
