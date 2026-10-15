import { useEffect, useState } from 'react'
import { useAuthUser } from './useAuthUser'

// Sessão do modo demonstração: claim demo no ID token (posta só pelo backend no custom token). A documentação do
// Firebase não garante que a claim sobrevive à renovação do token, então o uid do elenco (prefixo demo-, que o
// Firebase nunca gera sozinho) também conta. Só decide se a barra aparece; a barreira real é o backend.
export function useModoDemo(): boolean {
  const { usuario } = useAuthUser()
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let vivo = true
    setDemo(false)
    if (!usuario || typeof usuario.getIdTokenResult !== 'function') return
    const doElenco = typeof usuario.uid === 'string' && usuario.uid.startsWith('demo-')
    usuario
      .getIdTokenResult()
      .then((r) => vivo && setDemo(r.claims.demo === true || doElenco))
      .catch(() => vivo && setDemo(doElenco))
    return () => {
      vivo = false
    }
  }, [usuario])

  return demo
}
