import { useState, type FormEvent } from 'react'
import Spinner from '../components/common/Spinner'
import { getCurrentUserToken } from '../lib/auth'
import { formatarDataHora, rotuloRefeicao } from '../lib/alimentacaoFormato'

// Esqueleto cru da Fase 7, item 7.1 (RF-018): registrar refeição ou plano alimentar (POST /alimentacao do idoso e
// POST /alimentacao/idoso/:idosoId do familiar), pra exercitar os endpoints sem depender do front delas. A
// listagem (7.2) é a seção "Ver histórico alimentar", mais abaixo. Sem polish visual: layout final é de
// Laureane/Jennifer. O frontend não sabe quem é cuidador:
// cuidador nunca cria e o 403 do backend vira mensagem (limitação aceita). Não usa chamarApi (repassa o corpo do
// erro): as mensagens são fixas por status e nunca ecoam o corpo (a descrição pode revelar dado de saúde, RNF-001).
// Sem console.*.

const REFEICOES = [
  ['cafe_manha', 'Café da manhã'],
  ['lanche_manha', 'Lanche da manhã'],
  ['almoco', 'Almoço'],
  ['lanche_tarde', 'Lanche da tarde'],
  ['jantar', 'Jantar'],
  ['ceia', 'Ceia'],
]

const MENSAGEM_ERRO: Record<number, string> = {
  400: 'Dados inválidos. Confira refeição, descrição e data e hora.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para registrar esta refeição.',
}
const ERRO_GENERICO = 'Não foi possível registrar a refeição.'

const VAZIO = { idosoId: '', refeicao: 'cafe_manha', descricao: '', dataHora: '' }

export default function Alimentacao() {
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [criadoId, setCriadoId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleRegistrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCriadoId(null)
    setCarregando(true)
    try {
      const token = await getCurrentUserToken()
      const caminho = campos.idosoId === '' ? '/alimentacao' : `/alimentacao/idoso/${campos.idosoId}`
      const res = await fetch(`${import.meta.env.VITE_API_URL}${caminho}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refeicao: campos.refeicao,
          descricao: campos.descricao,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
        }),
      })
      if (!res.ok) {
        setErro(MENSAGEM_ERRO[res.status] ?? ERRO_GENERICO)
        return
      }
      const corpo = await res.json().catch(() => null)
      if (typeof corpo?.id === 'number') setCriadoId(corpo.id)
      else setErro(ERRO_GENERICO)
    } catch {
      setErro(ERRO_GENERICO)
    } finally {
      setCarregando(false)
    }
  }

  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const classeLabel = 'block text-lg font-medium text-gray-900'

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Alimentação</h1>
      <section aria-labelledby="titulo_registrar_refeicao" className="w-full max-w-sm space-y-4">
        <h2 id="titulo_registrar_refeicao" className="text-2xl font-bold text-gray-900">
          Registrar refeição
        </h2>
        <form onSubmit={handleRegistrar} className="space-y-4">
          <div>
            <label htmlFor="idoso_id_alimentacao" className={classeLabel}>
              Id do idoso (vazio = minha alimentação)
            </label>
            <input
              id="idoso_id_alimentacao"
              type="number"
              min={1}
              step={1}
              value={campos.idosoId}
              onChange={setCampo('idosoId')}
              className={classe}
            />
          </div>
          <div>
            <label htmlFor="refeicao_alimentacao" className={classeLabel}>
              Refeição
            </label>
            <select id="refeicao_alimentacao" value={campos.refeicao} onChange={setCampo('refeicao')} className={classe}>
              {REFEICOES.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="descricao_alimentacao" className={classeLabel}>
              Descrição
            </label>
            <textarea
              id="descricao_alimentacao"
              required
              maxLength={500}
              rows={4}
              value={campos.descricao}
              onChange={setCampo('descricao')}
              className={classe}
            />
          </div>
          <div>
            <label htmlFor="data_hora_alimentacao" className={classeLabel}>
              Data e hora
            </label>
            <input
              id="data_hora_alimentacao"
              type="datetime-local"
              required
              value={campos.dataHora}
              onChange={setCampo('dataHora')}
              className={classe}
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            aria-busy={carregando}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregando && <Spinner />}
            {carregando ? 'Registrando...' : 'Registrar refeição'}
          </button>
        </form>
        {erro && (
          <p role="alert" className="text-lg text-red-700">
            {erro}
          </p>
        )}
        {criadoId !== null && (
          <p role="status" className="text-lg text-gray-900">
            Refeição registrada (id {criadoId}).
          </p>
        )}
      </section>
      <VerHistoricoAlimentar />
    </main>
  )
}

// Item 7.2 (RF-019): ver o histórico alimentar. Id do idoso em branco = idoso lê o próprio (GET /alimentacao);
// preenchido = cuidador ou familiar (GET /alimentacao/idoso/:id). Sempre visível: leitura não depende de flag nem de
// modo_decisao (a autoridade é o 403 do backend). Lista plana na ordem recebida (o backend já ordena). Não atualiza
// sozinha depois de registrar (aceito). Não usa chamarApi: mensagens fixas por status, sem ecoar o corpo. Sem console.*.
const MENSAGEM_ERRO_HISTORICO: Record<number, string> = {
  400: 'Id de idoso inválido.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para ver este histórico alimentar.',
}
const ERRO_GENERICO_HISTORICO = 'Não foi possível carregar o histórico alimentar.'

// Só este erro tem mensagem exibível: qualquer outro (rede, token) cai na genérica, sem ecoar texto de fora.
class ErroHistorico extends Error {}

type RegistroApi = { id: number; refeicao: string; descricao: string; data_hora: string }
type ItemHistorico = { id: number; rotulo: string; iso: string; texto: string; descricao: string }

async function buscarHistorico(path: string): Promise<RegistroApi[]> {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ErroHistorico(MENSAGEM_ERRO_HISTORICO[res.status] ?? ERRO_GENERICO_HISTORICO)
  const corpo = await res.json().catch(() => null)
  if (!Array.isArray(corpo?.registros)) throw new ErroHistorico(ERRO_GENERICO_HISTORICO)
  return corpo.registros
}

function VerHistoricoAlimentar() {
  const [idosoId, setIdosoId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [itens, setItens] = useState<ItemHistorico[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleVer(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setItens(null)
    setCarregando(true)
    try {
      const registros = await buscarHistorico(idosoId === '' ? '/alimentacao' : `/alimentacao/idoso/${idosoId}`)
      // Formata tudo antes de exibir: um registro inválido vira erro, nunca lista pela metade.
      setItens(
        registros.map((r) => ({
          id: r.id,
          rotulo: rotuloRefeicao(r.refeicao),
          iso: r.data_hora,
          texto: formatarDataHora(r.data_hora),
          descricao: r.descricao,
        })),
      )
    } catch (err) {
      if (err instanceof RangeError) setErro('Não foi possível exibir o histórico alimentar.')
      else setErro(err instanceof ErroHistorico ? err.message : ERRO_GENERICO_HISTORICO)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section aria-labelledby="titulo_ver_historico_alimentar" className="w-full max-w-sm space-y-4">
      <h2 id="titulo_ver_historico_alimentar" className="text-2xl font-bold text-gray-900">
        Ver histórico alimentar
      </h2>
      <form onSubmit={handleVer} className="space-y-4">
        <div>
          <label htmlFor="idoso_id_historico_alimentar" className="block text-lg font-medium text-gray-900">
            Id do idoso para ver o histórico (vazio = meu histórico)
          </label>
          <input
            id="idoso_id_historico_alimentar"
            type="number"
            min={1}
            step={1}
            value={idosoId}
            onChange={(e) => setIdosoId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Carregando...' : 'Ver histórico alimentar'}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {carregando && (
        <p role="status" className="text-lg text-gray-900">
          Carregando o histórico alimentar...
        </p>
      )}
      {itens && (
        <p role="status" className="text-lg text-gray-900">
          {itens.length === 0 ? 'Nenhuma refeição registrada.' : `${itens.length} registro(s) encontrado(s).`}
        </p>
      )}
      {itens && itens.length > 0 && (
        <ul className="space-y-3 text-lg text-gray-900">
          {itens.map((i) => (
            <li key={i.id}>
              <p>
                <strong>{i.rotulo}</strong> <time dateTime={i.iso}>{i.texto}</time>
              </p>
              <p>{i.descricao}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
