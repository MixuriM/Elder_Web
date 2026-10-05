import Spinner from '../components/common/Spinner'
import BotaoTema from '../components/layout/BotaoTema'

import RegistrarMinhaSaude from '../components/Saude/RegistrarMinhaSaude'
import RegistrarSaudeIdoso from '../components/Saude/RegistrarSaudeIdoso'
import EditarSaude from '../components/Saude/EditarSaude'
import HistoricoSaude from '../components/Saude/HistoricoSaude'
import AvisoPermissaoSaude from '../components/Saude/AvisoPermissaoSaude'

import { usePermissoesSaude } from '../lib/permissoesSaude'

function Saude() {
  const permissoes = usePermissoesSaude()

  const mostrarEscritaDeTerceiros =
    permissoes.estado === 'erro' ||
    permissoes.escrita

  function voltarPagina() {
    window.history.back()
  }

  if (permissoes.estado === 'carregando') {
    return (
      <main
        className="
          relative
          flex min-h-screen
          items-center justify-center
          bg-[#F8F7FF]
          px-4

          dark:bg-[#0F0F17]
        "
      >
        <div className="fixed right-5 top-5 z-50">
          <BotaoTema />
        </div>

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
      </main>
    )
  }

  return (
    <main
      className="
        min-h-screen
        bg-[#F8F7FF]
        px-4 py-5

        dark:bg-[#0F0F17]

        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* TOPO */}

        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={voltarPagina}
            className="
              flex min-h-[48px]
              items-center gap-3
              rounded-2xl
              border border-[#DDD9F2]
              bg-white
              px-5 py-3
              font-semibold
              text-[#071A38]
              shadow-sm
              transition

              hover:border-[#6C63FF]
              hover:text-[#6C63FF]

              dark:border-[#393947]
              dark:bg-[#171721]
              dark:text-[#F5F5FA]

              dark:hover:border-[#9B96FF]
              dark:hover:text-[#9B96FF]
            "
          >
            <span
              className="text-xl"
              aria-hidden="true"
            >
              ←
            </span>

            Voltar
          </button>

          <BotaoTema />
        </div>

        {/* CABEÇALHO */}

        <header
          className="
            mb-8
            rounded-3xl
            border border-[#E5E2F5]
            bg-white
            px-6 py-7
            shadow-sm

            dark:border-[#393947]
            dark:bg-[#171721]

            md:px-8 md:py-8
          "
        >
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#6C63FF] dark:text-[#9B96FF]">
            Cuidados e bem-estar
          </span>

          <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] md:text-4xl">
            Minha Saúde
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] md:text-lg">
            Registre, acompanhe e mantenha suas informações
            de saúde organizadas em um só lugar.
          </p>
        </header>

        {/* PERMISSÕES */}

        <div className="mb-6">
          <AvisoPermissaoSaude
            permissoes={permissoes}
          />
        </div>

        {/* CONTEÚDO */}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* COLUNA ESQUERDA */}

          <div className="space-y-6">
            <RegistrarMinhaSaude />

            {mostrarEscritaDeTerceiros && (
              <RegistrarSaudeIdoso />
            )}
          </div>

          {/* COLUNA DIREITA */}

          <div className="space-y-6">
            <HistoricoSaude />

            <EditarSaude
              titulo="Editar meu registro"
              comIdoso={false}
            />

            {mostrarEscritaDeTerceiros && (
              <EditarSaude
                titulo="Editar registro do idoso"
                comIdoso
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default Saude