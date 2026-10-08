import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Pill,
  X,
} from 'lucide-react'

import { useFocoModal } from '../../hooks/useFocoModal'
import CadastroMedicamento from './CadastroMedicamento'

interface ModalMedicamentoProps {
  aberto: boolean
  onFechar: () => void
  idosoId?: string
  idosoNome?: string
}

function ModalMedicamento({
  aberto,
  onFechar,
  idosoId,
  idosoNome,
}: ModalMedicamentoProps) {
  const [cadastroConcluido, setCadastroConcluido] =
    useState(false)

  useEffect(() => {
    if (!aberto) {
      return
    }

    setCadastroConcluido(false)

    function fecharComEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onFechar()
      }
    }

    document.addEventListener(
      'keydown',
      fecharComEscape,
    )

    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener(
        'keydown',
        fecharComEscape,
      )

      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  const dialogoRef = useRef<HTMLElement>(null)

  useFocoModal(dialogoRef, aberto)

  if (!aberto) {
    return null
  }

  function handleSucesso() {
    setCadastroConcluido(true)

    window.setTimeout(() => {
      onFechar()
    }, 800)
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/60
        p-3
        backdrop-blur-sm

        sm:p-5
      "
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onFechar()
        }
      }}
    >
      <section
        ref={dialogoRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-medicamento"
        className="
          focus:!outline-none
          flex
          max-h-[92vh]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden
          rounded-3xl
          border
          border-[#E5E2F5]
          bg-white
          shadow-2xl

          dark:border-[#393947]
          dark:bg-[#171721]
        "
      >
        {/* CABEÇALHO */}

        <header
          className="
            flex
            shrink-0
            items-start
            justify-between
            gap-4
            border-b
            border-[#EEEAF8]
            px-5
            py-5

            sm:px-7

            dark:border-[#393947]
          "
        >
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#F3F0FF]
                text-[#5F56EC]

                dark:bg-[#29243F]
                dark:text-[#A89FFF]
              "
            >
              <Pill
                size={22}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  text-sm
                  font-semibold
                  text-[#5F56EC]

                  dark:text-[#A89FFF]
                "
              >
                Medicamentos
              </p>

              <h2
                id="titulo-modal-medicamento"
                className="
                  mt-0.5
                  text-xl
                  font-bold
                  text-[#071A38]

                  sm:text-2xl

                  dark:text-[#F5F5FA]
                "
              >
                Adicionar medicamento
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-[#56657D]

                  dark:text-[#C7C7D1]
                "
              >
                Preencha os dados do medicamento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-[#D9D7E8]
              bg-white
              text-[#56657D]
              transition

              hover:border-[#A18BFF]
              hover:bg-[#F3F0FF]
              hover:text-[#554CD8]

              dark:border-[#393947]
              dark:bg-[#20202A]
              dark:text-[#C7C7D1]

              dark:hover:border-[#555565]
              dark:hover:bg-[#292933]
              dark:hover:text-[#A89FFF]
            "
          >
            <X
              size={20}
              aria-hidden="true"
            />
          </button>
        </header>

        {/* CONTEÚDO ROLÁVEL */}

        <div
          className="
            overflow-y-auto
            px-5
            py-6

            sm:px-7

            dark:[color-scheme:dark]
          "
        >
          {cadastroConcluido && (
            <div
              role="status"
              className="
                mb-5
                rounded-xl
                border
                border-green-200
                bg-green-50
                px-4
                py-3
                text-sm
                font-semibold
                text-green-700

                dark:border-green-900/50
                dark:bg-green-950/20
                dark:text-green-300
              "
            >
              Medicamento adicionado com sucesso.
            </div>
          )}

          <CadastroMedicamento
            idosoId={idosoId}
            idosoNome={idosoNome}
            onSucesso={handleSucesso}
          />
        </div>
      </section>
    </div>
  )
}

export default ModalMedicamento