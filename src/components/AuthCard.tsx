import type { ReactNode } from "react"

interface AuthCardProps {
  title?: string
  children: ReactNode
}

export default function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full space-y-4">
      {title && (
        <h2 className="text-2xl font-bold text-center mb-4">{title}</h2>
      )}
      {children}
    </div>
  )
}
