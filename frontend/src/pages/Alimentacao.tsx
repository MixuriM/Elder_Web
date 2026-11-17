import { useState, type FormEvent } from 'react'
import { Utensils } from 'lucide-react'
import Spinner from '../components/common/Spinner'
import SeletorIdoso from '../components/common/SeletorIdoso'
import { envioBloqueado } from '../lib/regrasIdosoVinculado'
import { useIdososVinculados } from '../hooks/useIdososVinculados'
import { getCurrentUserToken } from '../lib/auth'
import { OPCOES_REFEICAO } from '../lib/alimentacaoFormato'
import HistoricoAlimentar from '../components/Alimentacao/HistoricoAlimentar'
import { useTitulo } from '../hooks/useTitulo'
import { useAcesso } from '../contexts/useAcesso'

// Cuidador nunca cria e o 403 do backend vira mensagem. Não usa chamarApi (repassa o corpo do erro): as mensagens
// são fixas por status e nunca ecoam o corpo (a descrição pode revelar dado de saúde, RNF-001). Sem console.*.

const MENSAGEM_ERRO: Record<number, string> = {
  400: 'Dados inválidos. Confira refeição, descrição e data e hora.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para registrar esta refeição.',
}
const ERRO_GENERICO = 'Não foi possível registrar a refeição.'

const VAZIO = { idosoId: '', refeicao: 'cafe_manha', descricao: '', dataHora: '' }

export default function Alimentacao() {
  useTitulo('Alimentação')
  const idosos = useIdososVinculados()
  // Cuidador nunca registra refeição: com o perfil conhecido, o formulário nem aparece para ele.
  const podeRegistrar = useAcesso().tipoPerfil !== 'cuidador'
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [criadoId, setCriadoId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Sobe a cada refeição registrada: o histórico recarrega sozinho.
  const [versao, setVersao] = useState(0)
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
      if (typeof corpo?.id === 'number') {
        setCriadoId(corpo.id)
        setVersao((v) => v + 1)
      }
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
    <div className="flex-1 bg-[#F8F7FF] px-4 py-6 dark:bg-[#0F0F17] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">

        <header className="mb-6 rounded-3xl border border-[#E5E2F5] bg-white px-5 py-7 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:mb-8 sm:px-8 sm:py-8">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#A89FFF]">
            Cuidado e acompanhamento
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">Alimentação</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] sm:text-lg">
            Registre refeições e acompanhe o histórico alimentar em um só lugar.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          {podeRegistrar && (
            <section
              aria-labelledby="titulo_registrar_refeicao"
              className="rounded-3xl border border-[#E5E2F5] bg-white p-4 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
            >
              <div className="mb-6 flex flex-wrap items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
                  <Utensils size={24} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <h2 id="titulo_registrar_refeicao" className="text-xl font-bold leading-snug text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
                    Registrar refeição
                  </h2>
                  <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
                    Anote uma refeição para manter as informações alimentares organizadas.
                  </p>
                </div>
              </div>
              <form onSubmit={handleRegistrar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    {OPCOES_REFEICAO.map(([valor, rotulo]) => (
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
                  Refeição registrada.
                </p>
              )}
            </section>
          )}
          <HistoricoAlimentar versao={versao} />
        </div>
      </div>
    </div>
  )
}
