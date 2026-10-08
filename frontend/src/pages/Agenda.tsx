import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { ArrowLeft, CalendarDays, Clock3, HeartPulse, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useIdososVinculados } from '../hooks/useIdososVinculados'
import { chamarApi } from '../lib/chamarApi'
import SeletorIdoso from '../components/common/SeletorIdoso'
import { envioBloqueado, ocultarSecaoDeTerceiros } from '../lib/regrasIdosoVinculado'
import Spinner from '../components/common/Spinner'
import BotaoTema from '../components/layout/BotaoTema'
import { getCurrentUserToken } from '../lib/auth'
import { agruparEventosPorDia, formatarIntervalo, rotuloTipo, type EventoAgenda, type GrupoDia } from '../lib/agendaPorDia'

const VAZIO = { idosoId: '', tipo: 'pessoal', titulo: '', descricao: '', inicio: '', fim: '' }

type Modo = 'idoso' | 'familiar' | 'cuidador'

function CriarCompromisso({ titulo, modo }: { titulo: string; modo: Modo }) {
  const sufixo = modo
  const comIdoso = modo !== 'idoso'
  const idosos = useIdososVinculados()
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
  const classe =
    'mt-1 min-h-12 w-full rounded-xl border border-[#DDD9F2] bg-white px-4 py-3 text-lg text-[#071A38] outline-none transition placeholder:text-[#78849A] hover:border-[#A18BFF] focus:border-[#5F56EC] focus:ring-2 focus:ring-[#5F56EC]/20 dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:placeholder:text-[#858594] dark:hover:border-[#66667A] dark:focus:border-[#A89FFF] dark:focus:ring-[#A89FFF]/20'
  const classeLabel = 'block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]'
  const campo = (
    rotulo: string,
    nome: keyof typeof VAZIO,
    atributos: InputHTMLAttributes<HTMLInputElement>,
    classeContainer = '',
  ) => (
    <div className={classeContainer}>
      <label htmlFor={`${nome}_${slug}`} className={classeLabel}>
        {rotulo}
      </label>
      <input id={`${nome}_${slug}`} {...atributos} value={campos[nome]} onChange={setCampo(nome)} className={classe} />
    </div>
  )
  // Criar em nome de terceiros não existe para o perfil idoso.
  if (comIdoso && ocultarSecaoDeTerceiros(idosos)) return null

  const IconeModo = modo === 'idoso' ? CalendarDays : modo === 'familiar' ? UsersRound : HeartPulse

  return (
    <section
      aria-labelledby={`titulo_criar_${slug}`}
      className="rounded-3xl border border-[#E5E2F5] bg-white p-5 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
    >
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
          <IconeModo size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id={`titulo_criar_${slug}`} className="text-xl font-bold leading-snug text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
            {titulo}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
            {modo === 'idoso'
              ? 'Adicione um compromisso à sua rotina.'
              : modo === 'familiar'
                ? 'Organize um compromisso para a pessoa vinculada.'
                : 'Registre um compromisso de cuidado para a pessoa vinculada.'}
          </p>
        </div>
      </div>
      <form onSubmit={handleCriar} className="grid gap-4 sm:grid-cols-2">
        {comIdoso && (
          <div className="sm:col-span-2">
            <SeletorIdoso
              id={`idosoId_${slug}`}
              escrita
              valor={campos.idosoId}
              aoMudar={(v) => setCampos((atual) => ({ ...atual, idosoId: v }))}
              lista={idosos}
            />
          </div>
        )}
        {modo !== 'cuidador' && (
          <div>
            <label htmlFor={`tipo_${slug}`} className={classeLabel}>
              Tipo ({sufixo})
            </label>
            <select id={`tipo_${slug}`} value={campos.tipo} onChange={setCampo('tipo')} className={classe}>
              <option value="pessoal">Pessoal</option>
              <option value="medico">Médico</option>
            </select>
          </div>
        )}
        {campo(`Título (${sufixo})`, 'titulo', { type: 'text', required: true, maxLength: 150 }, 'sm:col-span-2')}
        {campo(`Descrição (opcional, ${sufixo})`, 'descricao', { type: 'text', maxLength: 500 }, 'sm:col-span-2')}
        {campo(`Início (${sufixo})`, 'inicio', { type: 'datetime-local', required: true })}
        {campo(`Fim (opcional, ${sufixo})`, 'fim', { type: 'datetime-local' })}
        <button
          type="submit"
          disabled={carregando || (comIdoso && envioBloqueado(idosos, campos.idosoId))}
          aria-busy={carregando}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus:ring-2 focus:ring-[#5F56EC]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-[#171721] sm:col-span-2"
        >
          {carregando && <Spinner />}
          {carregando ? 'Criando...' : `Criar compromisso (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-base font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
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
    <section aria-labelledby={`dia_${grupo.dia}`} className="border-l-2 border-[#DDD9F2] pl-4 dark:border-[#454558] sm:pl-5">
      <h3 id={`dia_${grupo.dia}`} className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-xl">
        {grupo.rotulo}
        {grupo.hoje && (
          <span className="rounded-full bg-[#F0EDFF] px-3 py-1 text-sm font-bold text-[#554CD8] dark:bg-[#29263D] dark:text-[#B6B0FF]">
            (hoje)
          </span>
        )}
      </h3>
      <ul className="space-y-3">
        {grupo.eventos.map((e) => (
          <li key={e.id} className="rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-4 dark:border-[#393947] dark:bg-[#1D1D29] sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#F0EDFF] px-3 py-1 text-sm font-bold text-[#554CD8] dark:bg-[#29263D] dark:text-[#B6B0FF]">
                {rotuloTipo(e.tipo_evento)}
              </span>
              <p className="flex items-center gap-2 text-base font-semibold text-[#56657D] dark:text-[#C7C7D1]">
                <Clock3 size={18} aria-hidden="true" className="shrink-0 text-[#5F56EC] dark:text-[#A89FFF]" />
                <time dateTime={e.data_hora_inicio}>{formatarIntervalo(e)}</time>
              </p>
            </div>
            <p className="mt-3 text-lg font-bold text-[#071A38] dark:text-[#F5F5FA]">{e.titulo}</p>
            {e.descricao && <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">{e.descricao}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function VerAgenda() {
  const idosos = useIdososVinculados()
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
      const eventos = await buscarAgenda(idosos.ehIdoso ? '/agenda' : `/agenda/idoso/${idosoId}`)
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
    <section
      aria-labelledby="titulo_ver_agenda"
      className="rounded-3xl border border-[#E5E2F5] bg-white p-5 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
    >
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
          <CalendarDays size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="titulo_ver_agenda" className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
            Ver agenda
          </h2>
          <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
            Consulte os próximos compromissos e os anteriores.
          </p>
        </div>
      </div>
      <form onSubmit={handleVer} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="sm:min-w-80">
          <SeletorIdoso id="idoso_id_ver_agenda" valor={idosoId} aoMudar={setIdosoId} lista={idosos} />
        </div>
        <button
          type="submit"
          disabled={carregando || envioBloqueado(idosos, idosoId)}
          aria-busy={carregando}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus:ring-2 focus:ring-[#5F56EC]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-[#171721] sm:w-auto"
        >
          {carregando && <Spinner />}
          {carregando ? 'Carregando...' : 'Ver agenda'}
        </button>
      </form>
      {erro && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      )}
      {grupos && (
        <p role="status" className="mt-5 rounded-xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 text-base font-semibold text-[#071A38] dark:border-[#393947] dark:bg-[#1D1D29] dark:text-[#F5F5FA]">
          {grupos.length === 0
            ? 'Nenhum compromisso na agenda.'
            : `${grupos.reduce((n, g) => n + g.eventos.length, 0)} compromisso(s) encontrado(s).`}
        </p>
      )}
      {(proximos.length > 0 || passados.length > 0) && (
        <div className="mt-6 space-y-6">
          {passados.length > 0 && (
            <details className="space-y-4 rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-4 dark:border-[#393947] dark:bg-[#1D1D29] sm:p-5">
              <summary className="min-h-11 cursor-pointer py-2 text-base font-bold text-[#554CD8] outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC] dark:text-[#B6B0FF] dark:focus-visible:ring-[#A89FFF]">
                Compromissos anteriores
              </summary>
              <div className="space-y-6">
                {passados.map((g) => (
                  <DiaDaAgenda key={g.dia} grupo={g} />
                ))}
              </div>
            </details>
          )}
          {proximos.map((g) => (
            <DiaDaAgenda key={g.dia} grupo={g} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Agenda() {
  return (
    <main className="min-h-screen bg-[#F8F7FF] px-4 py-6 dark:bg-[#0F0F17] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <nav aria-label="Navegação da página" className="mb-6 flex items-center justify-between">
          <Link
            to="/Home"
            className="
              inline-flex min-h-11 items-center gap-2 rounded-xl
              border border-gray-300 bg-white px-4 font-semibold text-[#071A38]
              transition hover:border-[#A18BFF] hover:bg-[#F3F0FF]
              focus:outline-none focus:ring-4 focus:ring-[#A18BFF]/40
              dark:border-gray-700 dark:bg-[#151B35] dark:text-white dark:hover:bg-[#242A4A]
            "
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Voltar
          </Link>
          <BotaoTema />
        </nav>
        <header className="mb-6 rounded-3xl border border-[#E5E2F5] bg-white px-6 py-7 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:mb-8 sm:px-8 sm:py-8">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#A89FFF]">
            Organização e rotina
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">Agenda</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] sm:text-lg">
            Acompanhe consultas, compromissos pessoais e momentos de cuidado em um só lugar.
          </p>
        </header>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <CriarCompromisso titulo="Criar compromisso" modo="idoso" />
          <CriarCompromisso titulo="Criar compromisso para um idoso vinculado" modo="familiar" />
          <CriarCompromisso titulo="Criar compromisso de cuidado (cuidador)" modo="cuidador" />
          <VerAgenda />
        </div>
      </div>
    </main>
  )
}
