import { useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'

import { useAuthUser } from '../hooks/useAuthUser'
import { getCurrentUserToken, syncUser } from '../lib/auth'
import { useTitulo } from '../hooks/useTitulo'

function ConfirmarEmail() {
  useTitulo('Confirmar e-mail')
  const { usuario, carregando } = useAuthUser()

  const [status, setStatus] = useState<
    'idle' | 'confirmando' | 'sucesso' | 'erro'
  >('idle')

  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    setStatus('confirmando')
    setErro(null)

    try {
      await getCurrentUserToken(true)

      // tipoPerfil fixo: só importa quando o backend ainda não acha
      // o firebase_uid.
      await syncUser({ tipoPerfil: 'idoso' })

      setStatus('sucesso')
    } catch (err) {
      console.error('Falha ao confirmar e-mail:', err)

      setStatus('erro')

      setErro(
        err instanceof Error
          ? err.message
          : 'Falha ao confirmar e-mail.',
      )
    }
  }

  // =========================================================
  // CARREGANDO
  // =========================================================

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FF] p-6 dark:bg-[#10101A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#5F56EC]" />

          <p className="text-lg font-medium text-[#071A38] dark:text-[#F5F5FA]">
            Carregando...
          </p>
        </div>
      </main>
    )
  }

  // =========================================================
  // USUÁRIO NÃO LOGADO
  // =========================================================

  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F6FF] p-6 dark:bg-[#10101A]">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lg dark:bg-[#151B35] sm:p-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F3F0FF] dark:bg-[#6C63FF]/15">
            <AlertCircle className="h-10 w-10 text-[#5F56EC]" />
          </div>

          <h1 className="mb-3 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
            Confirmação de e-mail
          </h1>

          <p
            role="alert"
            className="text-lg leading-7 text-gray-600 dark:text-gray-300"
          >
            Faça login primeiro para confirmar seu e-mail.
          </p>
        </div>
      </main>
    )
  }

  // =========================================================
  // TELA PRINCIPAL
  // =========================================================

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F6FF] px-5 py-10 dark:bg-[#10101A]">

      {/* Decoração de fundo */}

      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#A18BFF]/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#6C63FF]/15 blur-3xl"
      />

      {/* Card */}

      <section className="relative z-10 w-full max-w-xl rounded-[28px] border border-[#6C63FF]/10 bg-white p-7 shadow-xl shadow-[#6C63FF]/10 dark:border-white/5 dark:bg-[#151B35] dark:shadow-black/20 sm:p-10">

        {/* Ícone */}

        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F3F0FF] dark:bg-[#6C63FF]/15">
          {status === 'sucesso' ? (
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          ) : (
            <Mail className="h-10 w-10 text-[#5F56EC]" />
          )}
        </div>

        {/* Título */}

        <h1 className="text-center text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-3xl">
          {status === 'sucesso'
            ? 'E-mail confirmado!'
            : 'Confirme seu e-mail'}
        </h1>

        {/* Descrição */}

        <p className="mx-auto mt-3 max-w-md text-center text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
          {status === 'sucesso'
            ? 'Tudo certo! Seu e-mail foi confirmado com sucesso.'
            : 'Confirme seu endereço de e-mail para continuar utilizando todos os recursos do Elder.'}
        </p>

        {/* E-mail */}

        {status !== 'sucesso' && usuario.email && (
          <div className="mt-7 rounded-2xl bg-[#F3F0FF] px-5 py-4 dark:bg-[#10101A]">
            <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
              E-mail da conta
            </p>

            <p className="break-all text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]">
              {usuario.email}
            </p>
          </div>
        )}

        {/* Botão */}

        {status !== 'sucesso' && (
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={status === 'confirmando'}
            className="
              mt-7
              flex
              min-h-[54px]
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#5F56EC]
              px-6
              py-3
              text-lg
              font-semibold
              text-white
              shadow-md
              transition-all
              duration-200

              hover:bg-[#5B54E8]
              hover:shadow-lg

              focus:outline-none
              focus:ring-4
              focus:ring-[#6C63FF]/30

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {status === 'confirmando' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Confirmar e-mail
              </>
            )}
          </button>
        )}

        {/* Sucesso */}

        {status === 'sucesso' && (
          <p
            role="status"
            className="mt-7 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-center text-base font-medium text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
          >
            E-mail confirmado com sucesso.
          </p>
        )}

        {/* Erro */}

        {status === 'erro' && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center text-base text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          >
            {erro ?? 'Ainda não confirmado, tente de novo mais tarde.'}
          </p>
        )}

        {/* Informação de segurança */}

        {status !== 'sucesso' && (
          <div className="mt-7 flex items-start gap-3 border-t border-gray-100 pt-6 dark:border-white/10">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5F56EC]" />

            <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
              A confirmação do e-mail ajuda a manter sua conta segura
              e garante o acesso correto aos seus dados no Elder.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

export default ConfirmarEmail