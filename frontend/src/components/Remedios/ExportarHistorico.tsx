import {
  useState,
  type FormEvent,
} from 'react'

import {
  Download,
  FileText,
} from 'lucide-react'

import { baixarPdf } from '../../lib/baixarPdf'
import Spinner from '../common/Spinner'

interface ExportarHistoricoProps {
  idosoId?: string
}

function ExportarHistorico({
  idosoId,
}: ExportarHistoricoProps) {
  const [carregando, setCarregando] =
    useState(false)

  const [erro, setErro] =
    useState<string | null>(null)

  const [sucesso, setSucesso] =
    useState(false)

  async function handleExportar(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setErro(null)
    setSucesso(false)
    setCarregando(true)

    try {
      const caminho = idosoId
        ? `/historico/idoso/${idosoId}/pdf`
        : '/historico/pdf'

      await baixarPdf(caminho)

      setSucesso(true)
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o histórico em PDF.',
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section
      className="
        rounded-3xl
        border
        border-[#E5E2F5]
        bg-white
        p-5
        shadow-sm
        transition-colors

        sm:p-6

        dark:border-[#393947]
        dark:bg-[#171721]
      "
    >
      <div
        className="
          flex
          flex-col
          gap-5

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div className="flex items-start gap-4">
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-[#F3F0FF]
              text-[#5F56EC]

              dark:bg-[#29243F]
              dark:text-[#A89FFF]
            "
          >
            <FileText
              size={24}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2
              className="
                text-xl
                font-bold
                text-[#071A38]

                dark:text-[#F5F5FA]
              "
            >
              Histórico em PDF
            </h2>

            <p
              className="
                mt-1
                max-w-xl
                text-sm
                leading-6
                text-[#56657D]

                dark:text-[#C7C7D1]
              "
            >
              Baixe o histórico dos
              medicamentos e das doses
              registradas.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleExportar}
          className="shrink-0"
        >
          <button
            type="submit"
            disabled={carregando}
            aria-busy={carregando}
            className="
              inline-flex
              min-h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#5F56EC]
              px-5
              py-3
              font-semibold
              text-white
              shadow-sm
              transition

              hover:bg-[#5A52E8]

              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6C63FF]/40
              focus-visible:ring-offset-2

              disabled:cursor-not-allowed
              disabled:opacity-60

              sm:w-auto

              dark:focus-visible:ring-offset-[#171721]
            "
          >
            {carregando ? (
              <Spinner />
            ) : (
              <Download
                size={19}
                aria-hidden="true"
              />
            )}

            {carregando
              ? 'Gerando PDF...'
              : 'Baixar histórico'}
          </button>
        </form>
      </div>

      {erro && (
        <div
          role="alert"
          className="
            mt-4
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            font-medium
            text-red-700

            dark:border-red-900/50
            dark:bg-red-950/20
            dark:text-red-300
          "
        >
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="
            mt-4
            rounded-xl
            border
            border-green-200
            bg-green-50
            px-4
            py-3
            text-sm
            font-medium
            text-green-700

            dark:border-green-900/50
            dark:bg-green-950/20
            dark:text-green-300
          "
        >
          PDF gerado. O download começou.
        </div>
      )}
    </section>
  )
}

export default ExportarHistorico