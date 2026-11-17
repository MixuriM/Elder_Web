import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'

import { avisoCookiesVisto, marcarAvisoCookiesVisto } from '../lib/preferencias'

// Aviso de cookies fixo no pé da tela, em todas as páginas, até a pessoa tocar em "Entendi". Não é um bloqueio: sem dialog, sem
// foco forçado, e o site segue usável por trás. Sem "aceitar" e "recusar": o Elder Web não tem cookie opcional (ver /cookies).
export default function AvisoCookies() {
  const [visto, setVisto] = useState(avisoCookiesVisto)

  if (visto) return null

  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-h-[70dvh] max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-[#E5E2F5] bg-white p-4 shadow-2xl sm:flex-row sm:items-center sm:gap-5 sm:p-5 dark:border-[#393947] dark:bg-[#171721]">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5F56EC] sm:flex dark:bg-[#29243F] dark:text-[#A89FFF]">
          <Cookie size={22} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[#071A38] dark:text-[#F5F5FA]">Cookies e armazenamento</p>

          <p className="mt-1 text-sm leading-6 text-[#56657D] dark:text-[#C7C7D1]">
            Não usamos cookies de publicidade nem de estatística. Guardamos no seu navegador só o necessário: suas
            preferências de tela, a sessão de login e uma cópia da sua foto.
          </p>

          <Link
            to="/cookies"
            className="mt-1 inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-[#554CD8] underline underline-offset-4 hover:text-[#4338CA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC] dark:text-[#B6B0FF] dark:hover:text-[#D0CCFF] dark:focus-visible:ring-[#A89FFF]"
          >
            Ler a política de cookies
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            marcarAvisoCookiesVisto()
            setVisto(true)
          }}
          className="min-h-11 w-full shrink-0 rounded-xl bg-[#5F56EC] px-6 py-2.5 text-base font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 sm:w-auto dark:focus-visible:ring-offset-[#171721]"
        >
          Entendi
        </button>
      </div>
    </section>
  )
}
