import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'
import { getCurrentUserToken } from '../lib/auth'
import { agruparEventosPorDia, formatarIntervalo, rotuloTipo, type EventoAgenda, type GrupoDia } from '../lib/agendaPorDia'

// Esqueleto cru da Fase 6, itens 6.1 (RF-015), 6.2 (RF-016) e 6.3 (RF-017): os formulários de criar compromisso (POST /agenda
// do idoso e POST /agenda/idoso/:idosoId do familiar e do cuidador) e a seção "Ver agenda" (GET), pra exercitar os
// endpoints sem depender do front delas. Sem calendário e sem polish visual: layout final é de Laureane/Jennifer. Idoso e
// familiar escolhem 'pessoal' ou 'medico' (nunca 'cuidado'); a seção do cuidador não tem select e envia sempre
// 'cuidado'. O frontend não sabe se o cuidador tem a flag permite_criar_evento_cuidado: a seção sempre
// aparece e o 403 do backend vira mensagem de erro (limitação aceita). Nunca loga o corpo enviado nem o título.

const VAZIO = { idosoId: '', tipo: 'pessoal', titulo: '', descricao: '', inicio: '', fim: '' }

type Modo = 'idoso' | 'familiar' | 'cuidador'

// O modo é também o sufixo dos rótulos e o slug dos ids de campo (únicos por seção).
function CriarCompromisso({ titulo, modo }: { titulo: string; modo: Modo }) {
  const sufixo = modo
  const comIdoso = modo !== 'idoso'
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ id: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const caminho = comIdoso ? `/agenda/idoso/${campos.idosoId}` : '/agenda'
      const corpo = await chamarApi(caminho, {
        method: 'POST',
        body: JSON.stringify({
          tipo_evento: modo === 'cuidador' ? 'cuidado' : campos.tipo,
          titulo: campos.titulo,
          descricao: campos.descricao === '' ? undefined : campos.descricao,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora_inicio: campos.inicio === '' ? undefined : new Date(campos.inicio).toISOString(),
          // Opcional em branco não é enviado.
          data_hora_fim: campos.fim === '' ? undefined : new Date(campos.fim).toISOString(),
        }),
      })
      setResultado(corpo)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar compromisso.')
    } finally {
      setCarregando(false)
    }
  }

  const slug = modo
  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const campo = (
    rotulo: string,
    nome: keyof typeof VAZIO,
    atributos: InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div>
      <label htmlFor={`${nome}_${slug}`} className="block text-lg font-medium text-gray-900">
        {rotulo}
      </label>
      <input id={`${nome}_${slug}`} {...atributos} value={campos[nome]} onChange={setCampo(nome)} className={classe} />
    </div>
  )

  return (
    <section className="w-full max-w-sm space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
      <form onSubmit={handleCriar} className="space-y-4">
        {comIdoso && campo(`Id do idoso (${sufixo})`, 'idosoId', { type: 'number', required: true, min: 1, step: 1 })}
        {modo !== 'cuidador' && (
          <div>
            <label htmlFor={`tipo_${slug}`} className="block text-lg font-medium text-gray-900">
              Tipo ({sufixo})
            </label>
            <select id={`tipo_${slug}`} value={campos.tipo} onChange={setCampo('tipo')} className={classe}>
              <option value="pessoal">Pessoal</option>
              <option value="medico">Médico</option>
            </select>
          </div>
        )}
        {campo(`Título (${sufixo})`, 'titulo', { type: 'text', required: true, maxLength: 150 })}
        {campo(`Descrição (opcional, ${sufixo})`, 'descricao', { type: 'text', maxLength: 500 })}
        {campo(`Início (${sufixo})`, 'inicio', { type: 'datetime-local', required: true })}
        {campo(`Fim (opcional, ${sufixo})`, 'fim', { type: 'datetime-local' })}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Criando...' : `Criar compromisso (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="text-lg text-gray-900">
          Compromisso criado (id {resultado.id}).
        </p>
      )}
    </section>
  )
}

// Item 6.3 (RF-017): ver a agenda. Id do idoso em branco = idoso lê a própria (GET /agenda); preenchido = cuidador ou
// familiar (GET /agenda/idoso/:id). Sempre visível: leitura não depende de flag nem de modo_decisao (a autoridade é
// o 403 do backend). Não usa chamarApi (força Content-Type JSON e repassa o corpo do erro): as mensagens de erro são
// fixas por status e nunca ecoam o corpo (título 'medico' pode ter dado de saúde, RNF-001). Sem console.*.
const MENSAGEM_ERRO_AGENDA: Record<number, string> = {
  400: 'Id de idoso inválido.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para ver esta agenda.',
}
const ERRO_GENERICO_AGENDA = 'Não foi possível carregar a agenda.'

// Só este erro tem mensagem exibível: qualquer outro (rede, token) cai na genérica, sem ecoar texto de fora.
class ErroAgenda extends Error {}

async function buscarAgenda(path: string): Promise<EventoAgenda[]> {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ErroAgenda(MENSAGEM_ERRO_AGENDA[res.status] ?? ERRO_GENERICO_AGENDA)
  const corpo = await res.json().catch(() => null)
  if (!Array.isArray(corpo?.eventos)) throw new ErroAgenda(ERRO_GENERICO_AGENDA)
  return corpo.eventos
}

function DiaDaAgenda({ grupo }: { grupo: GrupoDia }) {
  return (
    <section aria-labelledby={`dia_${grupo.dia}`} className="space-y-2">
      <h3 id={`dia_${grupo.dia}`} className="text-xl font-bold text-gray-900">
        {grupo.rotulo}
        {grupo.hoje ? ' (hoje)' : ''}
      </h3>
      <ul className="space-y-2 text-lg text-gray-900">
        {grupo.eventos.map((e) => (
          <li key={e.id}>
            <p>
              <strong>{rotuloTipo(e.tipo_evento)}</strong>{' '}
              <time dateTime={e.data_hora_inicio}>{formatarIntervalo(e)}</time>
            </p>
            <p>{e.titulo}</p>
            {e.descricao && <p>{e.descricao}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function VerAgenda() {
  const [idosoId, setIdosoId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [grupos, setGrupos] = useState<GrupoDia[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleVer(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setGrupos(null)
    setCarregando(true)
    try {
      const eventos = await buscarAgenda(idosoId === '' ? '/agenda' : `/agenda/idoso/${idosoId}`)
      setGrupos(agruparEventosPorDia(eventos))
    } catch (err) {
      if (err instanceof RangeError) setErro('Não foi possível exibir a agenda.')
      else setErro(err instanceof ErroAgenda ? err.message : ERRO_GENERICO_AGENDA)
    } finally {
      setCarregando(false)
    }
  }

  const passados = grupos?.filter((g) => g.passado) ?? []
  const proximos = grupos?.filter((g) => !g.passado) ?? []

  return (
    <section aria-labelledby="titulo_ver_agenda" className="w-full max-w-sm space-y-4">
      <h2 id="titulo_ver_agenda" className="text-2xl font-bold text-gray-900">
        Ver agenda
      </h2>
      <form onSubmit={handleVer} className="space-y-4">
        <div>
          <label htmlFor="idoso_id_ver_agenda" className="block text-lg font-medium text-gray-900">
            Id do idoso para ver a agenda (vazio = minha agenda)
          </label>
          <input
            id="idoso_id_ver_agenda"
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
          {carregando ? 'Carregando...' : 'Ver agenda'}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {grupos && (
        <p role="status" className="text-lg text-gray-900">
          {grupos.length === 0
            ? 'Nenhum compromisso na agenda.'
            : `${grupos.reduce((n, g) => n + g.eventos.length, 0)} compromisso(s) encontrado(s).`}
        </p>
      )}
      {passados.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-lg font-medium text-gray-900">Compromissos anteriores</summary>
          {passados.map((g) => (
            <DiaDaAgenda key={g.dia} grupo={g} />
          ))}
        </details>
      )}
      {proximos.map((g) => (
        <DiaDaAgenda key={g.dia} grupo={g} />
      ))}
    </section>
  )
}

export default function Agenda() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
      <CriarCompromisso titulo="Criar compromisso" modo="idoso" />
      <CriarCompromisso titulo="Criar compromisso para um idoso vinculado" modo="familiar" />
      <CriarCompromisso titulo="Criar compromisso de cuidado (cuidador)" modo="cuidador" />
      <VerAgenda />
    </main>
  )
}
