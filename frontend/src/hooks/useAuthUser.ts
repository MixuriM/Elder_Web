import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange } from '../lib/auth'

export function useAuthUser() {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    return onAuthChange((user) => {
      setUsuario(user)
      setCarregando(false)
    })
  }, [])

  return { usuario, carregando }
}
