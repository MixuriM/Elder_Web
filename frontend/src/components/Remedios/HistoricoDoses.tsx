import {
  CheckCircle2,
  Clock3,
  History,
  XCircle,
} from 'lucide-react'

export interface DoseHistorico {
  id: number
  status_administracao: string
  data_hora_administracao: string
  observacoes: string | null
}

interface HistoricoDosesProps {
  doses: DoseHistorico[]
}

const ROTULOS_STATUS: Record<
  string,
  string
> = {
  administrado: 'Administrado',
  pulado: 'Pulado',
  atrasado: 'Atrasado',
}

function formatarDataHora(data: string) {
  const valor = new Date(data)

  if (Number.isNaN(valor.getTime())) {
    return data
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    },
  ).format(valor)
}

function IconeStatus({
  status,
}: {
  status: string
}) {
  if (status === 'administrado') {
    return (
      <CheckCircle2
        size={20}
        aria-hidden="true"
      />
    )
  }

  if (status === 'pulado') {
    return (
      <XCircle
        size={20}
        aria-hidden="true"
      />
    )
  }

  return (
    <Clock3
      size={20}
      aria-hidden="true"
    />
  )
}

function classeStatus(status: string) {
  if (status === 'administrado') {
    return `
      border-green-200
      bg-green-50
      text-green-700

      dark:border-green-900/50
      dark:bg-green-950/20
      dark:text-green-300
    `
  }

  if (status === 'pulado') {
    return `
      border-red-200
      bg-red-50
      text-red-700

      dark:border-red-900/50
      dark:bg-red-950/20
      dark:text-red-300
    `
  }

  return `
    border-amber-200
    bg-amber-50
    text-amber-700

    dark:border-amber-900/50
    dark:bg-amber-950/20
    dark:text-amber-300
  `
}

function HistoricoDoses({
  doses,
}: HistoricoDosesProps) {
  if (doses.length === 0) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-dashed
          border-[#D9D7E8]
          bg-[#F8F7FF]
          px-5
          py-8
          text-center

          dark:border-[#393947]
          dark:bg-[#20202A]
        "
      >
        <div
          className="
            mx-auto
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            bg-[#F3F0FF]
            text-[#5F56EC]

            dark:bg-[#29243F]
            dark:text-[#A89FFF]
          "
        >
          <History
            size={23}
            aria-hidden="true"
          />
        </div>

        <p
          className="
            mt-4
            font-semibold
            text-[#071A38]

            dark:text-[#F5F5FA]
          "
        >
          Nenhuma dose registrada
        </p>

        <p
          className="
            mt-1
            text-sm
            leading-6
            text-[#56657D]

            dark:text-[#C7C7D1]
          "
        >
          As doses registradas deste
          medicamento aparecerão aqui.
        </p>
      </div>
    )
  }

  const dosesOrdenadas = [...doses].sort(
    (a, b) =>
      new Date(
        b.data_hora_administracao,
      ).getTime() -
      new Date(
        a.data_hora_administracao,
      ).getTime(),
  )

  return (
    <div className="space-y-3">
      {dosesOrdenadas.map((dose) => (
        <article
          key={dose.id}
          className="
            rounded-2xl
            border
            border-[#E5E2F5]
            bg-[#FDFDFF]
            p-4
            transition-colors

            dark:border-[#393947]
            dark:bg-[#20202A]
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3

              sm:flex-row
              sm:items-start
              sm:justify-between
            "
          >
            <div className="min-w-0">
              <div
                className={`
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  px-3
                  py-1.5
                  text-sm
                  font-semibold

                  ${classeStatus(
                    dose.status_administracao,
                  )}
                `}
              >
                <IconeStatus
                  status={
                    dose.status_administracao
                  }
                />

                {ROTULOS_STATUS[
                  dose.status_administracao
                ] ??
                  dose.status_administracao}
              </div>

              {dose.observacoes && (
                <p
                  className="
                    mt-3
                    break-words
                    text-sm
                    leading-6
                    text-[#56657D]

                    dark:text-[#C7C7D1]
                  "
                >
                  {dose.observacoes}
                </p>
              )}
            </div>

            <div
              className="
                flex
                shrink-0
                items-center
                gap-2
                text-sm
                font-medium
                text-[#56657D]

                dark:text-[#C7C7D1]
              "
            >
              <Clock3
                size={17}
                className="
                  text-[#5F56EC]

                  dark:text-[#A89FFF]
                "
                aria-hidden="true"
              />

              <time
                dateTime={
                  dose.data_hora_administracao
                }
              >
                {formatarDataHora(
                  dose.data_hora_administracao,
                )}
              </time>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

export default HistoricoDoses