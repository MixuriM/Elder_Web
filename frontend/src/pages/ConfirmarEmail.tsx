import { useState } from 'react'
import { useAuthUser } from '../hooks/useAuthUser'
import { getCurrentUserToken, syncUser } from '../lib/auth'

// Esqueleto cru da Fase 2, item 2.5 (RF-025) — só o necessário pra exercitar a
// promoção de vínculo pendente no backend a partir do link de confirmação de e-mail
// do Firebase, sem polish visual. Layout final é responsabilidade de
// Laureane/Jennifer; isto existe só pra não depender do front delas pra testar o back.
//
// Fluxo padrão do Firebase (sem handleCodeInApp): o e-mail já é marcado como
// verificado pelo próprio Firebase antes do usuário chegar aqui — esta página só
// precisa forçar um refresh do ID token e chamar syncUser() de novo pra promover o
// Vinculo pendente no backend (POST /auth/sync, branch de login).

function ConfirmarEmail() {
  const { usuario, carregando } = useAuthUser()
  const [status, setStatus] = useState<'idle' | 'confirmando' | 'sucesso' | 'erro'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    setStatus('confirmando')
    setErro(null)
    try {
      await getCurrentUserToken(true)
      // tipoPerfil fixo: só importa quando o backend ainda não acha o firebase_uid
      // (branch de criação/anexo, item 3.3 — idoso cadastrado por Familiar confirmando
      // e-mail pra assumir a conta). Pra Familiar (RF-025) o firebase_uid já bate desde
      // o cadastro, cai direto no branch de login, que ignora esse campo.
      await syncUser({ tipoPerfil: 'idoso' })
      setStatus('sucesso')
    } catch (err) {
      console.error('Falha ao confirmar e-mail:', err)
      setStatus('erro')
      setErro(err instanceof Error ? err.message : 'Falha ao confirmar e-mail.')
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8">
        <p className="text-lg text-gray-900">Carregando...</p>
      </main>
    )
  }

  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8">
        <p role="alert" className="text-lg text-gray-900">
          Faça login primeiro para confirmar seu e-mail.
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Confirmar e-mail</h1>
      <button
        type="button"
        onClick={handleConfirmar}
        disabled={status === 'confirmando'}
        className="rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-50"
      >
        Confirmar
      </button>
      {status === 'sucesso' && (
        <p role="status" className="text-lg text-green-700">
          E-mail confirmado com sucesso.
        </p>
      )}
      {status === 'erro' && (
        <p role="alert" className="text-lg text-red-700">
          {erro ?? 'Ainda não confirmado, tente de novo mais tarde.'}
        </p>
      )}
    </main>
  )
}

export default ConfirmarEmail
