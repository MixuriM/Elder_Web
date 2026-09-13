import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthUser } from '../hooks/useAuthUser'

function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuthUser()

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8">
        <p className="text-lg text-gray-900">Carregando...</p>
      </main>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default RotaProtegida
