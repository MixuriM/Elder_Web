import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  CheckCircle2,
  Clock3,
  Pill,
  X,
} from 'lucide-react'

import { chamarApi } from '../../lib/chamarApi'
import Spinner from '../common/Spinner'

import type { MedicamentoCard } from './CardMedicamento'

interface ModalMarcarDoseProps {
  aberto: boolean
  medicamento: MedicamentoCard | null
  idosoId?: string
  onFechar: () => void
  onSucesso?: () => void
}

type StatusDose =
  | 'administrado'
  | 'pulado'
  | 'atrasado'

function obterDataHoraAtual() {
  const agora = new Date()

  const deslocamento =
    agora.getTimezoneOffset() * 60 * 1000

  return new Date(
    agora.getTime() - deslocamento,
  )
    .toISOString()
    .slice(0, 16)
}

function ModalMarcarDose({
  aberto,
  medicamento,
  idosoId,
  onFechar,
  onSucesso,
}: ModalMarcarDoseProps) {
  const [status, setStatus] =
    useState<StatusDose>('administrado')

  const [dataHora, setDataHora] =
    useState(obterDataHoraAtual())

  const [observacoes, setObservacoes] =
    useState('')

  const [carregando, setCarregando] =
    useState(false)

  const [erro, setErro] =
    useState<string | null>(null)

  const [sucesso, setSucesso] =
    useState(false)

  useEffect(() => {
    if (!aberto) {
      return
    }

    setStatus('administrado')
    setDataHora(obterDataHoraAtual())
    setObservacoes('')
    setErro(null)
    setSucesso(false)
  }, [aberto, medicamento?.id])

  useEffect(() => {
    if (!aberto) {
      return
    }

    function fecharComEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape' &&
        !carregando
      ) {
        onFechar()
      }
    }

    document.addEventListener(
      'keydown',
      fecharComEscape,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        fecharComEscape,
      )
    }
  }, [aberto, carregando, onFechar])

  async function handleSalvar(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setErro(null)
    setSucesso(false)

    /*
     * Fazemos a validação novamente aqui porque
     * medicamento pode ser null de acordo com
     * ModalMarcarDoseProps.
     */
    if (!medicamento) {
      setErro(
        'Nenhum medicamento foi selecionado.',
      )
      return
    }

    setCarregando(true)

    try {
      /*
       * Depois da verificação acima, guardamos o ID
       * em uma constante. Assim o TypeScript sabe
       * que temos um número válido.
       */
      const medicamentoId =
        medicamento.id

      const caminho = idosoId
        ? `/remedios/idoso/${idosoId}/${medicamentoId}/doses`
        : `/remedios/${medicamentoId}/doses`

      await chamarApi(caminho, {
        method: 'POST',

        body: JSON.stringify({
          status_administracao: status,

          data_hora_administracao:
            dataHora === ''
              ? undefined
              : new Date(
                  dataHora,
                ).toISOString(),

          observacoes:
            observacoes.trim() === ''
              ? undefined
              : observacoes.trim(),
        }),
      })

      setSucesso(true)

      // Sem fechamento automático: a pessoa lê a confirmação e fecha em "Concluir".
      onSucesso?.()
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível registrar a dose.',
      )
    } finally {
      setCarregando(false)
    }
  }

  /*
   * Depois dos hooks e das funções.
   * Se o modal estiver fechado ou não existir
   * medicamento selecionado, não renderizamos.
   */
  if (!aberto || !medicamento) {
    return null
  }

  const classeCampo = `
    mt-2
    min-h-12
    w-full
    rounded-xl
    border
    border-[#D9D7E8]
    bg-white
    px-4
    py-3
    text-base
    text-[#071A38]
    outline-none
    transition

    placeholder:text-[#8B93A7]

    hover:border-[#BDB8DB]

    focus:border-[#6C63FF]
    focus:ring-2
    focus:ring-[#6C63FF]/15

    disabled:cursor-not-allowed
    disabled:opacity-60

    dark:border-[#3B3B49]
    dark:bg-[#10101A]
    dark:text-[#F5F5FA]
    dark:placeholder:text-[#A7A7B5]

    dark:hover:border-[#555565]

    dark:focus:border-[#9B96FF]
    dark:focus:ring-[#9B96FF]/20
  `

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
        p-4
        backdrop-blur-sm
      "
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !carregando
        ) {
          onFechar()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-dose"
        className="
          max-h-[90vh]
          w-full
          max-w-lg
          overflow-y-auto
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

        <div
          className="
            flex
            items-start
            justify-between
            gap-4
            border-b
            border-[#EEEAF8]
            p-5

            sm:p-6

            dark:border-[#393947]
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
              <Pill
                size={24}
                aria-hidden="true"
              />
            </div>

            <div>
              <p
                className="
                  text-sm
                  font-semibold
                  text-[#5F56EC]

                  dark:text-[#A89FFF]
                "
              >
                Registrar dose
              </p>

              <h2
                id="titulo-modal-dose"
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-[#071A38]

                  dark:text-[#F5F5FA]
                "
              >
                {medicamento.nome}
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-[#56657D]

                  dark:text-[#C7C7D1]
                "
              >
                {medicamento.dosagem}
                {' • '}
                {medicamento.frequencia}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
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

              disabled:cursor-not-allowed
              disabled:opacity-50

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
        </div>

        {/* FORMULÁRIO */}

        <form
          onSubmit={handleSalvar}
          className="space-y-5 p-5 sm:p-6"
        >
          {/* STATUS */}

          <fieldset>
            <legend
              className="
                text-sm
                font-semibold
                text-[#071A38]

                dark:text-[#F5F5FA]
              "
            >
              Situação da dose
            </legend>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    valor: 'administrado',
                    texto: 'Tomado',
                  },
                  {
                    valor: 'atrasado',
                    texto: 'Atrasado',
                  },
                  {
                    valor: 'pulado',
                    texto: 'Pulado',
                  },
                ] as const
              ).map((opcao) => {
                const selecionado =
                  status === opcao.valor

                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    disabled={carregando}
                    aria-pressed={
                      selecionado
                    }
                    onClick={() =>
                      setStatus(
                        opcao.valor,
                      )
                    }
                    className={`
                      min-h-12
                      rounded-xl
                      border
                      px-3
                      py-3
                      text-sm
                      font-semibold
                      transition

                      ${
                        selecionado
                          ? `
                            border-[#6C63FF]
                            bg-[#F3F0FF]
                            text-[#5F56EC]

                            dark:border-[#9B96FF]
                            dark:bg-[#29243F]
                            dark:text-[#A89FFF]
                          `
                          : `
                            border-[#D9D7E8]
                            bg-white
                            text-[#56657D]

                            hover:border-[#A18BFF]

                            dark:border-[#393947]
                            dark:bg-[#20202A]
                            dark:text-[#C7C7D1]

                            dark:hover:border-[#555565]
                          `
                      }

                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    `}
                  >
                    {opcao.texto}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* DATA E HORA */}

          <div>
            <label
              htmlFor="dose-data-hora"
              className="
                flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-[#071A38]

                dark:text-[#F5F5FA]
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

              Data e hora
            </label>

            <input
              id="dose-data-hora"
              type="datetime-local"
              required
              disabled={carregando}
              value={dataHora}
              onChange={(event) =>
                setDataHora(
                  event.target.value,
                )
              }
              className={classeCampo}
            />
          </div>

          {/* OBSERVAÇÕES */}

          <div>
            <label
              htmlFor="dose-observacoes"
              className="
                text-sm
                font-semibold
                text-[#071A38]

                dark:text-[#F5F5FA]
              "
            >
              Observações
            </label>

            <textarea
              id="dose-observacoes"
              rows={4}
              disabled={carregando}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value,
                )
              }
              placeholder="Adicione uma observação, se necessário."
              className={`
                ${classeCampo}
                resize-y
              `}
            />

            <p
              className="
                mt-2
                text-xs
                text-[#56657D]

                dark:text-[#A7A7B5]
              "
            >
              Campo opcional.
            </p>
          </div>

          {/* ERRO */}

          {erro && (
            <div
              role="alert"
              className="
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

          {/* SUCESSO */}

          {sucesso && (
            <div
              role="status"
              className="
                flex
                items-center
                gap-2
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
              <CheckCircle2
                size={19}
                aria-hidden="true"
                className="animate-check-entrada motion-reduce:animate-none"
              />

              Dose registrada com sucesso.
            </div>
          )}

          {/* BOTÕES */}

          <div
            className="
              flex
              flex-col-reverse
              gap-3
              pt-2

              sm:flex-row
              sm:justify-end
            "
          >
            <button
              type="button"
              onClick={onFechar}
              disabled={carregando}
              className="
                min-h-12
                rounded-xl
                border
                border-[#D9D7E8]
                bg-white
                px-5
                py-3
                font-semibold
                text-[#071A38]
                transition

                hover:border-[#A18BFF]
                hover:bg-[#F3F0FF]
                hover:text-[#554CD8]

                disabled:cursor-not-allowed
                disabled:opacity-50

                dark:border-[#393947]
                dark:bg-[#20202A]
                dark:text-[#F5F5FA]

                dark:hover:border-[#555565]
                dark:hover:bg-[#292933]
                dark:hover:text-[#A89FFF]
              "
            >
              {sucesso ? 'Concluir' : 'Cancelar'}
            </button>

            <button
              type="submit"
              disabled={carregando || sucesso}
              aria-busy={carregando}
              className="
                inline-flex
                min-h-12
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

                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {carregando ? (
                <Spinner />
              ) : (
                <CheckCircle2
                  size={19}
                  aria-hidden="true"
                />
              )}

              {carregando
                ? 'Registrando...'
                : 'Registrar dose'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ModalMarcarDose