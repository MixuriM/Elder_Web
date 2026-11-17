import { useState } from 'react'
import { Plus } from 'lucide-react'
import HistoricoAlimentar from '../components/Alimentacao/HistoricoAlimentar'
import ModalRegistrarRefeicao from '../components/Alimentacao/ModalRegistrarRefeicao'
import { useTitulo } from '../hooks/useTitulo'
import { useAcesso } from '../contexts/useAcesso'

export default function Alimentacao() {
  useTitulo('Alimentação')
  // Cuidador nunca registra refeição: com o perfil conhecido, o botão nem aparece para ele.
  const podeRegistrar = useAcesso().tipoPerfil !== 'cuidador'
  const [modalAberto, setModalAberto] = useState(false)
  const [registrou, setRegistrou] = useState(false)
  // Sobe a cada refeição registrada: o histórico recarrega sozinho.
  const [versao, setVersao] = useState(0)

  function abrirRegistro() {
    setRegistrou(false)
    setModalAberto(true)
  }

  return (
    <div className="flex-1 bg-[#F8F7FF] px-4 py-6 dark:bg-[#0F0F17] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 flex flex-col gap-5 rounded-3xl border border-[#E5E2F5] bg-white px-5 py-7 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
          <div className="min-w-0">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#A89FFF]">
              Cuidado e acompanhamento
            </span>
            <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">Alimentação</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] sm:text-lg">
              Registre refeições e acompanhe o histórico alimentar em um só lugar.
            </p>
          </div>

          {podeRegistrar && (
            <button
              type="button"
              onClick={abrirRegistro}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171721]"
            >
              <Plus size={20} aria-hidden="true" />
              Registrar refeição
            </button>
          )}
        </header>

        {registrou && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-base font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            Refeição registrada.
          </p>
        )}

        <HistoricoAlimentar versao={versao} onAdicionar={podeRegistrar ? abrirRegistro : undefined} />

        <ModalRegistrarRefeicao
          aberto={modalAberto}
          onFechar={() => setModalAberto(false)}
          onRegistrado={() => {
            setModalAberto(false)
            setRegistrou(true)
            setVersao((v) => v + 1)
          }}
        />
      </div>
    </div>
  )
}
