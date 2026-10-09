import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Pill,
} from 'lucide-react'

export interface MedicamentoCard {
  id: number
  nome: string
  dosagem: string
  frequencia: string
  data_inicio: string
  data_fim: string | null
  observacoes: string | null
  ativo: boolean
}

interface CardMedicamentoProps {
  medicamento: MedicamentoCard
  onMarcarDose: (
    medicamento: MedicamentoCard,
  ) => void
  onVerDetalhes: (
    medicamento: MedicamentoCard,
  ) => void
}

function formatarData(data: string) {
  const partes = data.split('-')

  if (partes.length !== 3) {
    return data
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function CardMedicamento({
  medicamento,
  onMarcarDose,
  onVerDetalhes,
}: CardMedicamentoProps) {
  return (
    <article
      className="
        flex
        h-full
        flex-col
        rounded-3xl
        border
        border-[#E5E2F5]
        bg-white
        p-5
        shadow-sm
        transition-all
        duration-200

        hover:-translate-y-0.5
        hover:border-[#CFC9F4]
        hover:shadow-md

        dark:border-[#393947]
        dark:bg-[#171721]

        dark:hover:border-[#555565]
      "
    >
      {/* CABEÇALHO */}

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
          <Pill
            size={24}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="
                  break-words
                  text-xl
                  font-bold
                  text-[#071A38]

                  dark:text-[#F5F5FA]
                "
              >
                {medicamento.nome}
              </h3>

              <p
                className="
                  mt-1
                  font-semibold
                  text-[#5F56EC]

                  dark:text-[#A89FFF]
                "
              >
                {medicamento.dosagem}
              </p>
            </div>

            <span
              className={`
                inline-flex
                shrink-0
                items-center
                gap-1.5
                rounded-full
                px-3
                py-1
                text-sm
                font-semibold

                ${
                  medicamento.ativo
                    ? `
                      bg-green-50
                      text-green-700

                      dark:bg-green-950/30
                      dark:text-green-300
                    `
                    : `
                      bg-gray-100
                      text-gray-600

                      dark:bg-[#20202A]
                      dark:text-[#A7A7B5]
                    `
                }
              `}
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full

                  ${
                    medicamento.ativo
                      ? 'bg-green-500'
                      : 'bg-gray-400'
                  }
                `}
                aria-hidden="true"
              />

              {medicamento.ativo
                ? 'Ativo'
                : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      {/* INFORMAÇÕES */}

      <div
        className="
          mt-5
          space-y-3
          border-t
          border-[#EEEAF8]
          pt-5

          dark:border-[#393947]
        "
      >
        <div className="flex items-start gap-3">
          <Clock3
            size={19}
            className="
              mt-0.5
              shrink-0
              text-[#5F56EC]

              dark:text-[#A89FFF]
            "
            aria-hidden="true"
          />

          <div>
            <p
              className="
                text-sm
                font-semibold
                uppercase
                tracking-wide
                text-[#8B93A7]

                dark:text-[#A7A7B5]
              "
            >
              Frequência
            </p>

            <p
              className="
                mt-0.5
                text-sm
                font-medium
                text-[#071A38]

                dark:text-[#F5F5FA]
              "
            >
              {medicamento.frequencia}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CalendarDays
            size={19}
            className="
              mt-0.5
              shrink-0
              text-[#5F56EC]

              dark:text-[#A89FFF]
            "
            aria-hidden="true"
          />

          <div>
            <p
              className="
                text-sm
                font-semibold
                uppercase
                tracking-wide
                text-[#8B93A7]

                dark:text-[#A7A7B5]
              "
            >
              Período
            </p>

            <p
              className="
                mt-0.5
                text-sm
                font-medium
                text-[#071A38]

                dark:text-[#F5F5FA]
              "
            >
              {formatarData(
                medicamento.data_inicio,
              )}

              {medicamento.data_fim
                ? ` até ${formatarData(
                    medicamento.data_fim,
                  )}`
                : ' — contínuo'}
            </p>
          </div>
        </div>

        {medicamento.observacoes && (
          <div
            className="
              rounded-xl
              bg-[#F8F7FF]
              px-4
              py-3

              dark:bg-[#20202A]
            "
          >
            <p
              className="
                text-sm
                font-semibold
                uppercase
                tracking-wide
                text-[#8B93A7]

                dark:text-[#A7A7B5]
              "
            >
              Observações
            </p>

            <p
              className="
                mt-1
                break-words
                text-sm
                leading-6
                text-[#56657D]

                dark:text-[#C7C7D1]
              "
            >
              {medicamento.observacoes}
            </p>
          </div>
        )}
      </div>

      {/* BOTÕES */}

      <div
        className="
          mt-auto
          grid
          gap-3
          pt-6

          sm:grid-cols-2
        "
      >
        <button
          type="button"
          onClick={() =>
            onMarcarDose(medicamento)
          }
          disabled={!medicamento.ativo}
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#5F56EC]
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            transition

            hover:bg-[#5A52E8]

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6C63FF]/40
            focus-visible:ring-offset-2

            disabled:cursor-not-allowed
            disabled:opacity-50

            dark:focus-visible:ring-offset-[#171721]
          "
        >
          <CheckCircle2
            size={18}
            aria-hidden="true"
          />

          Marcar dose
        </button>

        <button
          type="button"
          onClick={() =>
            onVerDetalhes(medicamento)
          }
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#D9D7E8]
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-[#071A38]
            transition

            hover:border-[#A18BFF]
            hover:bg-[#F3F0FF]
            hover:text-[#554CD8]

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6C63FF]/30

            dark:border-[#393947]
            dark:bg-[#20202A]
            dark:text-[#F5F5FA]

            dark:hover:border-[#555565]
            dark:hover:bg-[#292933]
            dark:hover:text-[#A89FFF]
          "
        >
          <Eye
            size={18}
            aria-hidden="true"
          />

          Ver histórico
        </button>
      </div>
    </article>
  )
}

export default CardMedicamento