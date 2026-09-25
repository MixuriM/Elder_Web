import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'

// Esqueleto cru da Fase 4, item 4.1 (RF-007): só o formulário de registro de leitura de
// saúde do idoso (POST /saude), pra exercitar o endpoint sem depender do front delas.
// Sem listagem, sem edição e sem polish visual: layout final é de Laureane/Jennifer.
// Item 4.2 (RF-008): segunda seção, cuidador registra leitura de um idoso vinculado
// (POST /saude/idoso/:idosoId), também esqueleto cru.
// Item 4.2b (RF-007, RF-009): a mesma seção serve o familiar (só com modo_decisao='familiar'
// no idoso; senão o backend responde 403 e a mensagem aparece em role="alert").
// Item 4.3 (RF-009, RNF-006): duas seções de edição (PATCH /saude/:id e
// PATCH /saude/idoso/:idosoId/:id). Edição substitui a leitura inteira, então reenvia todos os campos.

const LEITURA_VAZIA = {
  idosoId: '',
  tipoMedicao: '',
  valor1: '',
  valor2: '',
  unidade: '',
  dataHora: '',
  observacoes: '',
}

// Item 4.3: seção crua de edição. `comIdoso` escolhe a rota (idoso edita o próprio; cuidador/familiar
// edita de um idoso vinculado). Nunca loga corpo nem valores de saúde.
function EdicaoSaude({ titulo, sufixo, comIdoso }: { titulo: string; sufixo: string; comIdoso: boolean }) {
  const [campos, setCampos] = useState(LEITURA_VAZIA)
  const [registroId, setRegistroId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ id: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof LEITURA_VAZIA) => (e: ChangeEvent<HTMLInputElement>) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleEditar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const caminho = comIdoso ? `/saude/idoso/${campos.idosoId}/${registroId}` : `/saude/${registroId}`
      const corpo = await chamarApi(caminho, {
        method: 'PATCH',
        body: JSON.stringify({
          // Edição parcial: campo em branco não é enviado e o backend mantém o valor atual.
          tipo_medicao: campos.tipoMedicao === '' ? undefined : campos.tipoMedicao,
          valor_1: campos.valor1 === '' ? undefined : Number(campos.valor1),
          valor_2: campos.valor2 === '' ? undefined : Number(campos.valor2),
          unidade: campos.unidade === '' ? undefined : campos.unidade,
          data_hora: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
          observacoes: campos.observacoes === '' ? undefined : campos.observacoes,
        }),
      })
      setResultado(corpo)
    } catch (err) {
      console.error('Falha ao editar leitura de saúde:', err instanceof Error ? err.message : 'erro')
      setErro(err instanceof Error ? err.message : 'Falha ao editar leitura de saúde.')
    } finally {
      setCarregando(false)
    }
  }

  const slug = comIdoso ? 'ed_idoso' : 'ed_proprio'
  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const campoTexto = (
    rotulo: string,
    id: string,
    valor: string,
    aoMudar: (e: ChangeEvent<HTMLInputElement>) => void,
    atributos: InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div key={id}>
      <label htmlFor={id} className="block text-lg font-medium text-gray-900">
        {rotulo}
      </label>
      <input id={id} {...atributos} value={valor} onChange={aoMudar} className={classe} />
    </div>
  )

  return (
    <section className="w-full max-w-sm space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
      <form onSubmit={handleEditar} className="space-y-4">
        {comIdoso &&
          campoTexto(`Id do idoso (${sufixo})`, `idoso_id_${slug}`, campos.idosoId, setCampo('idosoId'), {
            type: 'number', required: true, min: 1, step: 1,
          })}
        {campoTexto(`Id do registro (${sufixo})`, `registro_id_${slug}`, registroId, (e) => setRegistroId(e.target.value), {
          type: 'number', required: true, min: 1, step: 1,
        })}
        {campoTexto(`Tipo de medição (${sufixo})`, `tipo_medicao_${slug}`, campos.tipoMedicao, setCampo('tipoMedicao'), {
          type: 'text', maxLength: 50,
        })}
        {campoTexto(`Valor 1 (${sufixo})`, `valor_1_${slug}`, campos.valor1, setCampo('valor1'), {
          type: 'number', min: 0, step: 'any',
        })}
        {campoTexto(`Valor 2 (opcional, ${sufixo})`, `valor_2_${slug}`, campos.valor2, setCampo('valor2'), {
          type: 'number', min: 0, step: 'any',
        })}
        {campoTexto(`Unidade (${sufixo})`, `unidade_${slug}`, campos.unidade, setCampo('unidade'), {
          type: 'text', maxLength: 20,
        })}
        {campoTexto(`Data e hora (opcional, ${sufixo})`, `data_hora_${slug}`, campos.dataHora, setCampo('dataHora'), {
          type: 'datetime-local',
        })}
        {campoTexto(`Observações (opcional, ${sufixo})`, `observacoes_${slug}`, campos.observacoes, setCampo('observacoes'), {
          type: 'text', maxLength: 300,
        })}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Salvando...' : `Salvar edição (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {resultado && <p className="text-lg text-gray-900">Registro atualizado (id {resultado.id}).</p>}
    </section>
  )
}

function Saude() {
  const [tipoMedicao, setTipoMedicao] = useState('')
  const [valorSaude1, setValorSaude1] = useState('')
  const [valorSaude2, setValorSaude2] = useState('')
  const [unidadeSaude, setUnidadeSaude] = useState('')
  const [dataHoraSaude, setDataHoraSaude] = useState('')
  const [observacoesSaude, setObservacoesSaude] = useState('')
  const [carregandoSaude, setCarregandoSaude] = useState(false)
  const [resultadoSaude, setResultadoSaude] = useState<{ id: number } | null>(null)
  const [erroSaude, setErroSaude] = useState<string | null>(null)

  // Item 4.1 (RF-007). Não loga o corpo enviado nem os valores: dado de saúde é sensível.
  async function handleRegistrarSaude(e: FormEvent) {
    e.preventDefault()
    setErroSaude(null)
    setResultadoSaude(null)
    setCarregandoSaude(true)
    try {
      const corpo = await chamarApi('/saude', {
        method: 'POST',
        body: JSON.stringify({
          tipo_medicao: tipoMedicao,
          valor_1: Number(valorSaude1),
          valor_2: valorSaude2 === '' ? undefined : Number(valorSaude2),
          unidade: unidadeSaude,
          data_hora: dataHoraSaude === '' ? undefined : new Date(dataHoraSaude).toISOString(),
          observacoes: observacoesSaude === '' ? undefined : observacoesSaude,
        }),
      })
      setResultadoSaude(corpo)
    } catch (err) {
      console.error('Falha ao registrar leitura de saúde:', err instanceof Error ? err.message : 'erro')
      setErroSaude(err instanceof Error ? err.message : 'Falha ao registrar leitura de saúde.')
    } finally {
      setCarregandoSaude(false)
    }
  }

  const [cuid, setCuid] = useState(LEITURA_VAZIA)
  const [carregandoCuid, setCarregandoCuid] = useState(false)
  const [resultadoCuid, setResultadoCuid] = useState<{ id: number } | null>(null)
  const [erroCuid, setErroCuid] = useState<string | null>(null)
  const setCampoCuid = (campo: keyof typeof LEITURA_VAZIA) => (e: ChangeEvent<HTMLInputElement>) =>
    setCuid((atual) => ({ ...atual, [campo]: e.target.value }))

  // Item 4.2 (RF-008). Mesmo cuidado do 4.1: nunca loga corpo nem valores de saúde.
  async function handleRegistrarSaudeCuidador(e: FormEvent) {
    e.preventDefault()
    setErroCuid(null)
    setResultadoCuid(null)
    setCarregandoCuid(true)
    try {
      const corpo = await chamarApi(`/saude/idoso/${cuid.idosoId}`, {
        method: 'POST',
        body: JSON.stringify({
          tipo_medicao: cuid.tipoMedicao,
          valor_1: Number(cuid.valor1),
          valor_2: cuid.valor2 === '' ? undefined : Number(cuid.valor2),
          unidade: cuid.unidade,
          data_hora: cuid.dataHora === '' ? undefined : new Date(cuid.dataHora).toISOString(),
          observacoes: cuid.observacoes === '' ? undefined : cuid.observacoes,
        }),
      })
      setResultadoCuid(corpo)
    } catch (err) {
      console.error('Falha ao registrar leitura de saúde:', err instanceof Error ? err.message : 'erro')
      setErroCuid(err instanceof Error ? err.message : 'Falha ao registrar leitura de saúde.')
    } finally {
      setCarregandoCuid(false)
    }
  }

  const campoClasse = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const rotuloClasse = 'block text-lg font-medium text-gray-900'

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Registrar leitura de saúde (só idoso)</h1>
        <form onSubmit={handleRegistrarSaude} className="space-y-4">
          <div>
            <label htmlFor="tipo_medicao_saude" className="block text-lg font-medium text-gray-900">
              Tipo de medição
            </label>
            <input
              id="tipo_medicao_saude"
              type="text"
              required
              maxLength={50}
              value={tipoMedicao}
              onChange={(e) => setTipoMedicao(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="valor_1_saude" className="block text-lg font-medium text-gray-900">
              Valor 1
            </label>
            <input
              id="valor_1_saude"
              type="number"
              required
              min={0}
              step="any"
              value={valorSaude1}
              onChange={(e) => setValorSaude1(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="valor_2_saude" className="block text-lg font-medium text-gray-900">
              Valor 2 (opcional)
            </label>
            <input
              id="valor_2_saude"
              type="number"
              min={0}
              step="any"
              value={valorSaude2}
              onChange={(e) => setValorSaude2(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="unidade_saude" className="block text-lg font-medium text-gray-900">
              Unidade
            </label>
            <input
              id="unidade_saude"
              type="text"
              required
              maxLength={20}
              value={unidadeSaude}
              onChange={(e) => setUnidadeSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="data_hora_saude" className="block text-lg font-medium text-gray-900">
              Data e hora (opcional)
            </label>
            <input
              id="data_hora_saude"
              type="datetime-local"
              value={dataHoraSaude}
              onChange={(e) => setDataHoraSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="observacoes_saude" className="block text-lg font-medium text-gray-900">
              Observações (opcional)
            </label>
            <input
              id="observacoes_saude"
              type="text"
              maxLength={300}
              value={observacoesSaude}
              onChange={(e) => setObservacoesSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={carregandoSaude}
            aria-busy={carregandoSaude}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoSaude && <Spinner />}
            {carregandoSaude ? 'Registrando...' : 'Registrar leitura'}
          </button>
        </form>
        {erroSaude && (
          <p role="alert" className="text-lg text-red-700">
            {erroSaude}
          </p>
        )}
        {resultadoSaude && <p className="text-lg text-gray-900">Leitura registrada (id {resultadoSaude.id}).</p>}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Registrar leitura de saúde de um idoso (cuidador ou familiar)</h2>
        <form onSubmit={handleRegistrarSaudeCuidador} className="space-y-4">
          {(
            [
              ['idosoId', 'Id do idoso', 'idoso_id_cuid', { type: 'number', required: true, min: 1, step: 1 }],
              ['tipoMedicao', 'Tipo de medição (cuidador)', 'tipo_medicao_cuid', { type: 'text', required: true, maxLength: 50 }],
              ['valor1', 'Valor 1 (cuidador)', 'valor_1_cuid', { type: 'number', required: true, min: 0, step: 'any' }],
              ['valor2', 'Valor 2 (opcional, cuidador)', 'valor_2_cuid', { type: 'number', min: 0, step: 'any' }],
              ['unidade', 'Unidade (cuidador)', 'unidade_cuid', { type: 'text', required: true, maxLength: 20 }],
              ['dataHora', 'Data e hora (opcional, cuidador)', 'data_hora_cuid', { type: 'datetime-local' }],
              ['observacoes', 'Observações (opcional, cuidador)', 'observacoes_cuid', { type: 'text', maxLength: 300 }],
            ] as const
          ).map(([campo, rotulo, id, atributos]) => (
            <div key={id}>
              <label htmlFor={id} className={rotuloClasse}>
                {rotulo}
              </label>
              <input id={id} {...atributos} value={cuid[campo]} onChange={setCampoCuid(campo)} className={campoClasse} />
            </div>
          ))}
          <button
            type="submit"
            disabled={carregandoCuid}
            aria-busy={carregandoCuid}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoCuid && <Spinner />}
            {carregandoCuid ? 'Registrando...' : 'Registrar leitura do idoso'}
          </button>
        </form>
        {erroCuid && (
          <p role="alert" className="text-lg text-red-700">
            {erroCuid}
          </p>
        )}
        {resultadoCuid && <p className="text-lg text-gray-900">Leitura do idoso registrada (id {resultadoCuid.id}).</p>}
      </section>

      <EdicaoSaude titulo="Editar registro de saúde (próprio, idoso)" sufixo="edição" comIdoso={false} />
      <EdicaoSaude
        titulo="Editar registro de saúde de um idoso (cuidador ou familiar)"
        sufixo="edição, idoso vinculado"
        comIdoso
      />
    </main>
  )
}

export default Saude
