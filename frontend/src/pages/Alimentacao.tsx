import { useState, type FormEvent } from 'react'
import { ArrowLeft, ClipboardList, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import Spinner from '../components/common/Spinner'
import BotaoTema from '../components/layout/BotaoTema'
import SeletorIdoso from '../components/common/SeletorIdoso'
import { envioBloqueado } from '../lib/regrasIdosoVinculado'
import { useIdososVinculados } from '../hooks/useIdososVinculados'
import { getCurrentUserToken } from '../lib/auth'
import { formatarDataHora, rotuloRefeicao } from '../lib/alimentacaoFormato'

// Cuidador nunca cria e o 403 do backend vira mensagem. Não usa chamarApi (repassa o corpo do erro): as mensagens
// são fixas por status e nunca ecoam o corpo (a descrição pode revelar dado de saúde, RNF-001). Sem console.*.

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
  const idosos = useIdososVinculados()
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
      const caminho = idosos.ehIdoso ? '/alimentacao' : `/alimentacao/idoso/${campos.idosoId}`
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

  const classeCampo =
    'mt-1 min-h-12 w-full rounded-xl border border-[#DDD9F2] bg-white px-4 py-3 text-lg text-[#071A38] outline-none transition placeholder:text-[#78849A] hover:border-[#A18BFF] focus:border-[#5F56EC] focus:ring-2 focus:ring-[#5F56EC]/20 dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:placeholder:text-[#858594] dark:hover:border-[#66667A] dark:focus:border-[#A89FFF] dark:focus:ring-[#A89FFF]/20'
  const classeLabel = 'block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]'

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-4 py-6 dark:bg-[#0F0F17] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <nav aria-label="Navegação da página" className="mb-6 flex items-center justify-between">
          <Link
            to="/Home"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 font-semibold text-[#071A38] transition hover:border-[#A18BFF] hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 dark:border-gray-700 dark:bg-[#151B35] dark:text-white dark:hover:bg-[#242A4A]"
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Voltar
          </Link>
          <BotaoTema />
        </nav>

        <header className="mb-6 rounded-3xl border border-[#E5E2F5] bg-white px-6 py-7 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:mb-8 sm:px-8 sm:py-8">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#A89FFF]">
            Cuidado e acompanhamento
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">Alimentação</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] sm:text-lg">
            Registre refeições e acompanhe o histórico alimentar em um só lugar.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <section
            aria-labelledby="titulo_registrar_refeicao"
            className="rounded-3xl border border-[#E5E2F5] bg-white p-5 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
          >
            <div className="mb-6 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
                <Utensils size={24} aria-hidden="true" />
              </span>
              <div>
                <h2 id="titulo_registrar_refeicao" className="text-xl font-bold leading-snug text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
                  Registrar refeição
                </h2>
                <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
                  Anote uma refeição para manter as informações alimentares organizadas.
                </p>
              </div>
            </div>
            <form onSubmit={handleRegistrar} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 empty:hidden">
                <SeletorIdoso
                  id="idoso_id_alimentacao"
                  escrita
                  valor={campos.idosoId}
                  aoMudar={(v) => setCampos((atual) => ({ ...atual, idosoId: v }))}
                  lista={idosos}
                />
              </div>
              <div>
                <label htmlFor="refeicao_alimentacao" className={classeLabel}>
                  Refeição
                </label>
                <select
                  id="refeicao_alimentacao"
                  value={campos.refeicao}
                  onChange={setCampo('refeicao')}
                  className={classeCampo}
                >
                  {REFEICOES.map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
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
                  className={classeCampo}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="data_hora_alimentacao" className={classeLabel}>
                  Data e hora
                </label>
                <input
                  id="data_hora_alimentacao"
                  type="datetime-local"
                  required
                  value={campos.dataHora}
                  onChange={setCampo('dataHora')}
                  className={classeCampo}
                />
              </div>
              <button
                type="submit"
                disabled={carregando || envioBloqueado(idosos, campos.idosoId)}
                aria-busy={carregando}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-[#171721] sm:col-span-2"
              >
                {carregando && <Spinner />}
                {carregando ? 'Registrando...' : 'Registrar refeição'}
              </button>
            </form>
            {erro && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {erro}
              </p>
            )}
            {criadoId !== null && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-base font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                Refeição registrada (id {criadoId}).
              </p>
            )}
          </section>
          <VerHistoricoAlimentar />
        </div>
      </div>
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
  const idosos = useIdososVinculados()
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
      const registros = await buscarHistorico(idosos.ehIdoso ? '/alimentacao' : `/alimentacao/idoso/${idosoId}`)
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
    <section
      aria-labelledby="titulo_ver_historico_alimentar"
      className="rounded-3xl border border-[#E5E2F5] bg-white p-5 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
    >
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
          <ClipboardList size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="titulo_ver_historico_alimentar" className="text-xl font-bold leading-snug text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
            Ver histórico alimentar
          </h2>
          <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
            Consulte refeições registradas para você ou para uma pessoa vinculada.
          </p>
        </div>
      </div>
      <form onSubmit={handleVer} className="space-y-4">
        <SeletorIdoso id="idoso_id_historico_alimentar" valor={idosoId} aoMudar={setIdosoId} lista={idosos} />
        <button
          type="submit"
          disabled={carregando || envioBloqueado(idosos, idosoId)}
          aria-busy={carregando}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-[#171721]"
        >
          {carregando && <Spinner />}
          {carregando ? 'Carregando...' : 'Ver histórico alimentar'}
        </button>
      </form>
      {erro && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      )}
      {carregando && (
        <p role="status" className="mt-4 rounded-xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 text-base font-medium text-[#071A38] dark:border-[#393947] dark:bg-[#20202D] dark:text-[#F5F5FA]">
          Carregando o histórico alimentar...
        </p>
      )}
      {itens && (
        <p role="status" className="mt-4 rounded-xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 text-base font-medium text-[#071A38] dark:border-[#393947] dark:bg-[#20202D] dark:text-[#F5F5FA]">
          {itens.length === 0 ? 'Nenhuma refeição registrada.' : `${itens.length} registro(s) encontrado(s).`}
        </p>
      )}
      {itens && itens.length > 0 && (
        <ul className="mt-5 space-y-3">
          {itens.map((i) => (
            <li key={i.id} className="rounded-2xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 dark:border-[#393947] dark:bg-[#20202D]">
              <p className="font-bold text-[#071A38] dark:text-[#F5F5FA]">
                <strong>{i.rotulo}</strong>
              </p>
              <time dateTime={i.iso} className="mt-1 block text-sm font-medium text-[#5F56EC] dark:text-[#A89FFF]">
                {i.texto}
              </time>
              <p className="mt-2 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">{i.descricao}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
