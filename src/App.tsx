import { useEffect } from "react"
import { Routes, Route, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"
import OnboardingTour from "./components/OnboardingTour"
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
    <div className="w-full min-h-screen bg-[#0c0d0e] text-white">
      {!hideNavbar && <Navbar />}
      {!hideNavbar && <OnboardingTour />}
      <div className="w-full">
        <Routes>
          {/* Login accesible tanto en "/" como en "/login" para enlaces
              entrantes desde la landing externa (nes-landing). */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/explorar" element={<Explorar />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfil-publico/:id" element={<PerfilPublico />} />
          <Route path="/completar-perfil" element={<CompletarPerfil />} />

          {/* Hub de mensajería unificado (Chats + Grupos) */}
          <Route path="/chats" element={<Mensajes />} />
          <Route path="/chat/:id" element={<Mensajes />} />
          <Route path="/grupos" element={<Mensajes />} />
          <Route path="/group/:id" element={<Mensajes />} />

          {/* Páginas de gestión de grupos */}
          <Route path="/create-group" element={<CreateGroup />} />
          <Route path="/group/:id/info" element={<GroupInfo />} />
          <Route path="/group/:id/add-members" element={<AddMembers />} />

          <Route path="/workflow" element={<Workflow />} />
          <Route path="/calendario" element={<Calendario />} />
        </Routes>
      </div>
    </div>
  )
}
