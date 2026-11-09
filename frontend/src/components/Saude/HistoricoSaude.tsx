
import { useState, type FormEvent, type ReactNode } from 'react'

import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { chamarApi } from '../../lib/chamarApi'
import SeletorIdoso from '../common/SeletorIdoso'
import { envioBloqueado } from '../../lib/regrasIdosoVinculado'
import Spinner from '../common/Spinner'

type RegistroLista = {
  id: number
  tipo_medicao: string
  valor_1: number
  valor_2: number | null
  unidade: string
  data_hora: string
  observacoes?: string | null
}

type FormularioEdicao = {
  tipo_medicao: string
  valor_1: string
  valor_2: string
  unidade: string
  data_hora: string
  observacoes: string
}

function formatarDataInput(data: string) {
  const d = new Date(data)

  if (Number.isNaN(d.getTime())) return ''

  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000,
  )

  return local.toISOString().slice(0, 16)
}

function HistoricoSaude({ children }: { children?: ReactNode }) {
  const idosos = useIdososVinculados()

  const [idosoId, setIdosoId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [registros, setRegistros] =
    useState<RegistroLista[] | null>(null)

  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [registroEditando, setRegistroEditando] =
    useState<number | null>(null)

  const [formulario, setFormulario] =
    useState<FormularioEdicao>({
      tipo_medicao: '',
      valor_1: '',
      valor_2: '',
      unidade: '',
      data_hora: '',
      observacoes: '',
    })

  async function carregarHistorico() {
    const caminho = idosos.ehIdoso
      ? '/saude'
      : `/saude/idoso/${idosoId}`

    const corpo = await chamarApi(caminho, {
      method: 'GET',
    })

    setRegistros(corpo.registros)
  }

  async function handleVer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setErro(null)
    setSucesso(null)
    setRegistros(null)
    setRegistroEditando(null)
    setCarregando(true)

    try {
      await carregarHistorico()
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar histórico de saúde.',
      )
    } finally {
      setCarregando(false)
    }
  }

  function iniciarEdicao(registro: RegistroLista) {
    if (!idosos.ehIdoso || salvando) return

    setErro(null)
    setSucesso(null)
    setRegistroEditando(registro.id)

    setFormulario({
      tipo_medicao: registro.tipo_medicao,
      valor_1: String(registro.valor_1),
      valor_2:
        registro.valor_2 === null
          ? ''
          : String(registro.valor_2),
      unidade: registro.unidade,
      data_hora: formatarDataInput(registro.data_hora),
      observacoes: registro.observacoes ?? '',
    })
  }

  function cancelarEdicao() {
    if (salvando) return

    setRegistroEditando(null)
    setErro(null)
  }

  function alterarCampo(
    campo: keyof FormularioEdicao,
    valor: string,
  ) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }))
  }

  function converterValor(valor: string) {
    return Number(valor.replace(',', '.'))
  }

  function valorNumericoValido(valor: number) {
    return (
      Number.isFinite(valor) &&
      valor >= 0 &&
      valor <= 9999.99 &&
      /^\d+(\.\d{1,2})?$/.test(String(valor))
    )
  }

  async function salvarEdicao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (registroEditando === null || !idosos.ehIdoso || salvando) {
      return
    }

    setErro(null)
    setSucesso(null)

    const valor1 = converterValor(formulario.valor_1)
    const valor2 =
      formulario.valor_2.trim() === ''
        ? null
        : converterValor(formulario.valor_2)

    if (
      !valorNumericoValido(valor1) ||
      (valor2 !== null && !valorNumericoValido(valor2))
    ) {
      setErro('Informe valores entre 0 e 9999,99, com até duas casas decimais.')
      return
    }

    if (
      !formulario.tipo_medicao.trim() ||
      formulario.tipo_medicao.trim().length > 50 ||
      !formulario.unidade.trim() ||
      formulario.unidade.trim().length > 20 ||
      formulario.observacoes.trim().length > 300
    ) {
      setErro('Confira os campos de medição, unidade e observações.')
      return
    }

    const data = new Date(formulario.data_hora)

    if (
      !formulario.data_hora ||
      Number.isNaN(data.getTime()) ||
      data.getTime() > Date.now() + 5 * 60 * 1000
    ) {
      setErro('Informe uma data e hora válidas.')
      return
    }

    setSalvando(true)

    try {
      await chamarApi(`/saude/${registroEditando}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tipo_medicao: formulario.tipo_medicao.trim(),
          valor_1: valor1,
          valor_2: valor2,
          unidade: formulario.unidade.trim(),
          data_hora: data.toISOString(),
          observacoes: formulario.observacoes.trim() || null,
        }),
      })

      setRegistroEditando(null)
      setSucesso('Registro de saúde atualizado com sucesso!')

      try {
        await carregarHistorico()
      } catch {
        setErro(
          'O registro foi salvo, mas não foi possível atualizar o histórico. Consulte novamente.',
        )
      }
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar o registro de saúde.',
      )
    } finally {
      setSalvando(false)
    }
  }

  const campoClassName = `
    w-full min-h-[48px] rounded-xl
    border border-[#E5E2F5]
    bg-white px-4 py-3
    text-[#071A38]
    outline-none
    focus:border-[#5F56EC]
    focus:ring-2 focus:ring-[#5F56EC]/20
    dark:border-[#393947]
    dark:bg-[#171721]
    dark:text-[#F5F5FA]
  `

  const labelClassName = `
    mb-2 block text-sm font-semibold
    text-[#071A38]
    dark:text-[#F5F5FA]
  `

  return (
    <section
      className="
        w-full rounded-3xl
        border border-[#E5E2F5]
        bg-white p-6 shadow-sm
        dark:border-[#393947]
        dark:bg-[#171721]
        md:p-8
      "
    >
      <div className="mb-7">
        <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#5F56EC] dark:text-[#9B96FF]">
          Histórico
        </span>

        <h2 className="mt-2 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
          Histórico de saúde
        </h2>

        <p className="mt-2 text-[#56657D] dark:text-[#C7C7D1]">
          Consulte as medições registradas.
        </p>
      </div>

      <form onSubmit={handleVer} className="space-y-5">
        <SeletorIdoso
          id="idoso_id_historico"
          valor={idosoId}
          aoMudar={(valor) => {
            setIdosoId(valor)
            setRegistros(null)
            setRegistroEditando(null)
            setErro(null)
            setSucesso(null)
          }}
          lista={idosos}
        />

        <button
          type="submit"
          disabled={
            carregando ||
            salvando ||
            envioBloqueado(idosos, idosoId)
          }
          className="
            flex min-h-[54px] w-full
            items-center justify-center gap-2
            rounded-xl bg-[#5F56EC]
            px-5 py-3.5 text-lg
            font-semibold text-white
            hover:bg-[#5C54E8]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {carregando && <Spinner />}

          {carregando ? 'Carregando...' : 'Ver histórico'}
        </button>
      </form>

      {erro && (
        <div
          role="alert"
          className="
            mt-5 rounded-xl border border-red-200
            bg-red-50 p-4 text-red-700
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
            mt-5 rounded-xl border border-green-200
            bg-green-50 p-4 text-green-800
            dark:border-green-900/50
            dark:bg-green-950/20
            dark:text-green-300
          "
        >
          {sucesso}
        </div>
      )}

      {registros && registros.length === 0 && (
        <div className="mt-6 rounded-2xl border border-[#E5E2F5] bg-[#F8F7FC] p-6 text-center dark:border-[#393947] dark:bg-[#1C1C27]">
          <p className="font-semibold text-[#56657D] dark:text-[#C7C7D1]">
            Nenhum registro encontrado.
          </p>
        </div>
      )}

      {registros && registros.length > 0 && (
        <div className="mt-7 space-y-3">
          {registros.map((registro) => {
            const editando = registroEditando === registro.id

            return (
              <article
                key={registro.id}
                className="
                  rounded-2xl
                  border border-[#E5E2F5]
                  bg-[#FAF9FD] p-5
                  dark:border-[#393947]
                  dark:bg-[#1C1C27]
                "
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-[#071A38] dark:text-[#F5F5FA]">
                    {registro.tipo_medicao}
                  </h3>

                  <span className="text-sm font-semibold text-[#5F56EC] dark:text-[#9B96FF]">
                    #{registro.id}
                  </span>
                </div>

                {editando ? (
                  <form
                    onSubmit={salvarEdicao}
                    className="mt-5 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor={`tipo-${registro.id}`}
                        className={labelClassName}
                      >
                        Tipo de medição
                      </label>

                      <input
                        id={`tipo-${registro.id}`}
                        type="text"
                        maxLength={50}
                        required
                        disabled={salvando}
                        className={campoClassName}
                        value={formulario.tipo_medicao}
                        onChange={(e) =>
                          alterarCampo('tipo_medicao', e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`valor1-${registro.id}`}
                          className={labelClassName}
                        >
                          Valor 1
                        </label>

                        <input
                          id={`valor1-${registro.id}`}
                          type="text"
                          inputMode="decimal"
                          required
                          disabled={salvando}
                          className={campoClassName}
                          value={formulario.valor_1}
                          onChange={(e) =>
                            alterarCampo('valor_1', e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`valor2-${registro.id}`}
                          className={labelClassName}
                        >
                          Valor 2 (opcional)
                        </label>

                        <input
                          id={`valor2-${registro.id}`}
                          type="text"
                          inputMode="decimal"
                          disabled={salvando}
                          className={campoClassName}
                          value={formulario.valor_2}
                          onChange={(e) =>
                            alterarCampo('valor_2', e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`unidade-${registro.id}`}
                        className={labelClassName}
                      >
                        Unidade
                      </label>

                      <input
                        id={`unidade-${registro.id}`}
                        type="text"
                        maxLength={20}
                        required
                        disabled={salvando}
                        className={campoClassName}
                        value={formulario.unidade}
                        onChange={(e) =>
                          alterarCampo('unidade', e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`data-${registro.id}`}
                        className={labelClassName}
                      >
                        Data e hora
                      </label>

                      <input
                        id={`data-${registro.id}`}
                        type="datetime-local"
                        required
                        disabled={salvando}
                        className={campoClassName}
                        value={formulario.data_hora}
                        onChange={(e) =>
                          alterarCampo('data_hora', e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`obs-${registro.id}`}
                        className={labelClassName}
                      >
                        Observações (opcional)
                      </label>

                      <textarea
                        id={`obs-${registro.id}`}
                        rows={3}
                        maxLength={300}
                        disabled={salvando}
                        className={campoClassName}
                        value={formulario.observacoes}
                        onChange={(e) =>
                          alterarCampo('observacoes', e.target.value)
                        }
                      />

                      <p className="mt-1 text-right text-xs text-[#56657D] dark:text-[#AFAFBD]">
                        {formulario.observacoes.length}/300
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={salvando}
                        className="
                          flex min-h-[48px] items-center
                          justify-center gap-2
                          rounded-xl bg-[#5F56EC]
                          px-5 py-3 font-semibold
                          text-white hover:bg-[#5C54E8]
                          disabled:opacity-60
                        "
                      >
                        {salvando && <Spinner />}
                        {salvando
                          ? 'Salvando...'
                          : 'Salvar alterações'}
                      </button>

                      <button
                        type="button"
                        disabled={salvando}
                        onClick={cancelarEdicao}
                        className="
                          min-h-[48px] rounded-xl
                          border border-[#E5E2F5]
                          px-5 py-3 font-semibold
                          text-[#56657D]
                          hover:bg-[#ECEAF4]
                          dark:border-[#393947]
                          dark:text-[#C7C7D1]
                          dark:hover:bg-[#34343F]
                          disabled:opacity-60
                        "
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="mt-3 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
                      {registro.valor_1}

                      {registro.valor_2 !== null
                        ? ` / ${registro.valor_2}`
                        : ''}

                      <span className="ml-2 text-base font-medium text-[#56657D] dark:text-[#C7C7D1]">
                        {registro.unidade}
                      </span>
                    </p>

                    <p className="mt-3 border-t border-[#ECEAF4] pt-3 text-sm text-[#56657D] dark:border-[#34343F] dark:text-[#AFAFBD]">
                      {new Date(registro.data_hora).toLocaleString('pt-BR')}
                    </p>

                    {registro.observacoes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[#56657D] dark:text-[#C7C7D1]">
                        <span className="font-semibold">
                          Observações:
                        </span>{' '}
                        {registro.observacoes}
                      </p>
                    )}

                    {idosos.ehIdoso && (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => iniciarEdicao(registro)}
                          className="
                            min-h-[44px] rounded-xl
                            border border-[#5F56EC]
                            px-5 py-2.5 font-semibold
                            text-[#5F56EC]
                            hover:bg-[#5F56EC]/10
                            focus-visible:outline
                            focus-visible:outline-2
                            focus-visible:outline-offset-2
                            focus-visible:outline-[#5F56EC]
                            dark:border-[#9B96FF]
                            dark:text-[#9B96FF]
                            disabled:opacity-60
                          "
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

      {registros !== null && children && (
        <div className="mt-7 space-y-4 border-t border-[#E5E2F5] pt-6 dark:border-[#393947]">
          {children}
        </div>
      )}
    </section>
  )
}

export default HistoricoSaude
