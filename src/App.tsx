import { Routes, Route, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"

import Login from "./pages/Login"
import Register from "./pages/Register"
import Explorar from "./pages/Explorar"
import Perfil from "./pages/Perfil"
import Grupos from "./pages/Grupos"
import Foros from "./pages/Foros"
import Chat from "./pages/Chat"
import CompletarPerfil from "./pages/CompletarPerfil"
import Mensajes from "./pages/Mensajes"
import PerfilPublico from "./pages/PerfilPublico"
import Workflow from "./pages/Workflow"
import Calendario from "./pages/Calendario"
import CreateGroup from "./pages/CreateGroup"
import GroupChat from "./pages/GroupChat"
import GroupInfo from "./pages/GroupInfo"
import AddMembers from "./pages/AddMembers"

export default function App() {
  const location = useLocation()

  const hideNavbar = location.pathname === "/" || location.pathname === "/register"

  return (
    <div className="w-full min-h-screen bg-[#0f0f11] text-white flex justify-center">
      <div className="app-container">

        {/* 🚀 SOLO MOSTRAR NAVBAR SI NO ES AUTH */}
        {!hideNavbar && <Navbar />}

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/explorar" element={<Explorar />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfil-publico/:id" element={<PerfilPublico />} />
          <Route path="/completar-perfil" element={<CompletarPerfil />} />

          <Route path="/chats" element={<Mensajes />} />
          <Route path="/chat/:id" element={<Chat />} />

          <Route path="/grupos" element={<Grupos />} />
          <Route path="/create-group" element={<CreateGroup />} />
          <Route path="/group/:id" element={<GroupChat />} />
          <Route path="/group/:id/info" element={<GroupInfo />} />
          <Route path="/group/:id/add-members" element={<AddMembers />} />

          <Route path="/foros" element={<Foros />} />
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/calendario" element={<Calendario />} />
        </Routes>

      </div>
    </div>
  )
}