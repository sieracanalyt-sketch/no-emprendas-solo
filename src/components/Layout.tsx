import Navbar from "./Navbar"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col">

      <Navbar />

      <main className="w-full flex justify-center">
        <div className="w-full max-w-5xl px-4">
          {children}
        </div>
      </main>

    </div>
  )
}