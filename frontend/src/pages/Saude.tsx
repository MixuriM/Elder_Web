
import { useState } from 'react'
import { Plus } from 'lucide-react'

import Spinner from '../components/common/Spinner'

import ModalRegistrarSaude from '../components/Saude/ModalRegistrarSaude'
import HistoricoSaude from '../components/Saude/HistoricoSaude'
import AvisoPermissaoSaude from '../components/Saude/AvisoPermissaoSaude'

import { usePermissoesSaude } from '../lib/permissoesSaude'
import { useTitulo } from '../hooks/useTitulo'
import { useAcesso } from '../contexts/useAcesso'

function Saude() {
  useTitulo('Saúde')

  const permissoes = usePermissoesSaude()

  // Sobe a cada registro novo: o histórico recarrega sozinho.
  const [versao, setVersao] = useState(0)
  const [modalAberto, setModalAberto] = useState(false)
  const [registrou, setRegistrou] = useState(false)

  // Registro próprio de saúde só existe para o idoso.
  const { tipoPerfil } = useAcesso()

  const ehTerceiro =
    tipoPerfil === 'cuidador' || tipoPerfil === 'familiar'

  const mostrarEscritaDeTerceiros =
    permissoes.estado === 'erro' ||
    permissoes.escrita

  // Idoso registra a própria leitura; familiar e cuidador registram para um idoso vinculado (cuidador só com a permissão).
  const podeRegistrar = !ehTerceiro || mostrarEscritaDeTerceiros

  function abrirRegistro() {
    setRegistrou(false)
    setModalAberto(true)
  }

  if (permissoes.estado === 'carregando') {
    return (
      <div
        className="
          relative
          flex flex-1
          items-center justify-center
          bg-[#F8F7FF]
          px-4

          dark:bg-[#0F0F17]
        "
      >
        <div
          className="
            flex flex-col
            items-center
            gap-4
            rounded-2xl
            border border-[#E5E2F5]
            bg-white
            px-10 py-8
            shadow-sm

            dark:border-[#393947]
            dark:bg-[#171721]
          "
        >
          <Spinner />

          <p className="text-center font-medium text-[#56657D] dark:text-[#C7C7D1]">
            Carregando informações de saúde...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="
        flex-1
        bg-[#F8F7FF]
        px-4 py-5

        dark:bg-[#0F0F17]

        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* CABEÇALHO */}

        <header
          className="
            mb-8
            flex flex-col gap-5
            rounded-3xl
            border border-[#E5E2F5]
            bg-white
            px-6 py-7
            shadow-sm

            dark:border-[#393947]
            dark:bg-[#171721]

            md:px-8 md:py-8

            sm:flex-row sm:items-end sm:justify-between
          "
        >
          <div className="min-w-0">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#9B96FF]">
              Cuidados e bem-estar
            </span>

            <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] md:text-4xl">
              {ehTerceiro ? 'Saúde do idoso' : 'Minha Saúde'}
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] md:text-lg">
              {ehTerceiro
                ? 'Acompanhe as informações de saúde do idoso em um só lugar.'
                : 'Registre, acompanhe e mantenha suas informações de saúde organizadas em um só lugar.'}
            </p>
          </div>

          {podeRegistrar && (
            <button
              type="button"
              onClick={abrirRegistro}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171721]"
            >
              <Plus size={20} aria-hidden="true" />
              Registrar leitura
            </button>
          )}
        </header>

        {/* PERMISSÕES */}

        <div className="mb-6">
          <AvisoPermissaoSaude
            permissoes={permissoes}
          />
        </div>

        {/* AVISO DE SUCESSO */}

        {registrou && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 font-medium text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300"
          >
            Leitura registrada com sucesso.
          </div>
        )}

        {/* HISTÓRICO */}

        <HistoricoSaude
          versao={versao}
          escritaTerceiros={mostrarEscritaDeTerceiros}
          onAdicionar={podeRegistrar ? abrirRegistro : undefined}
        />

        <ModalRegistrarSaude
          aberto={modalAberto}
          onFechar={() => setModalAberto(false)}
          terceiro={ehTerceiro}
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

export default Saude
