import { useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { useIdososVinculados } from '../hooks/useIdososVinculados'
import SeletorIdoso from '../components/common/SeletorIdoso'
import { envioBloqueado } from '../lib/regrasIdosoVinculado'
import Spinner from '../components/common/Spinner'
import { agruparEventosPorDia, type EventoAgenda, type GrupoDia } from '../lib/agendaPorDia'
import { lerVisaoAgenda, salvarVisaoAgenda, type VisaoAgenda } from '../lib/preferencias'
import { useRegistrosDoIdoso } from '../lib/registrosDoIdoso'
import { modoDeCriacao, podeAlterarCompromisso } from '../lib/regrasAgenda'
import { caminhoRegistro } from '../lib/registrosDoIdoso'
import { chamarApi } from '../lib/chamarApi'
import { mensagemPorStatus } from '../components/Vinculos/mensagensVinculo'
import Alternador from '../components/Agenda/Alternador'
import Calendario from '../components/Agenda/Calendario'
import CartaoCompromisso from '../components/Agenda/CartaoCompromisso'
import ModalCriarCompromisso from '../components/Agenda/ModalCriarCompromisso'
import ModalConfirmar from '../components/common/ModalConfirmar'
import { AcoesCompromissoContext, type AcoesCompromisso } from '../components/Agenda/acoesCompromisso'
import { useTitulo } from '../hooks/useTitulo'
import { useAcesso } from '../contexts/useAcesso'

// Item 6.3 (RF-017) e Fase 11: a agenda carrega sozinha. Idoso lê a própria (GET /agenda); cuidador e familiar leem a do
// idoso escolhido (GET /agenda/idoso/:id). Leitura não depende de flag nem de modo_decisao (a autoridade é o 403 do
// backend). As mensagens de erro são fixas por status e nunca ecoam o corpo (título 'medico' pode ter dado de saúde,
// RNF-001). Sem console.*. Agenda segue sem editar nem remover (sem rota no backend).
const mensagemErroAgenda = (erro: unknown) =>
  erro instanceof RangeError
    ? 'Não foi possível exibir a agenda.'
    : mensagemPorStatus(
        erro,
        {
          400: 'Id de idoso inválido.',
          401: 'Sessão expirada. Entre novamente.',
          403: 'Você não tem permissão para ver esta agenda.',
        },
        'Não foi possível carregar a agenda.',
      )

// Agrupa tudo antes de exibir: um evento com data inválida lança RangeError e vira erro, nunca lista pela metade.
const agrupar = (eventos: unknown[]) => agruparEventosPorDia(eventos as EventoAgenda[])

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
          <li key={e.id}>
            <CartaoCompromisso evento={e} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const VISOES = [
  { valor: 'calendario', rotulo: 'Calendário' },
  { valor: 'lista', rotulo: 'Lista' },
] as const

const CAIXA_INFO =
  'mt-5 rounded-xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 text-base font-semibold text-[#071A38] dark:border-[#393947] dark:bg-[#1D1D29] dark:text-[#F5F5FA]'

function AreaAgenda() {
  const idosos = useIdososVinculados()
  const { tipoPerfil, vinculos } = useAcesso()
  const [idosoId, setIdosoId] = useState('')
  const [versao, setVersao] = useState(0)
  const [modalAberto, setModalAberto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<EventoAgenda | null>(null)
  const [removendo, setRemovendo] = useState<EventoAgenda | null>(null)
  const [visao, setVisao] = useState<VisaoAgenda>(() => lerVisaoAgenda().visao)

  // Cada ator cria o que o backend aceita (o resto dá 403): o botão só aparece para quem cria.
  const modo = modoDeCriacao({ tipoPerfil, idosos, vinculos })
  // Cuidador e familiar criam para o idoso já escolhido aqui; assim o compromisso novo aparece no calendário aberto.
  const idosoNome = idosos.idosos.find((i) => String(i.id) === idosoId)?.nome

  const agenda = useRegistrosDoIdoso<GrupoDia>({
    base: '/agenda',
    campo: 'eventos',
    idosos,
    idosoId,
    versao,
    mensagemErro: mensagemErroAgenda,
    transformar: agrupar,
  })
  const grupos = agenda.registros
  const passados = grupos?.filter((g) => g.passado) ?? []
  const proximos = grupos?.filter((g) => !g.passado) ?? []

  const escolhaPendente =
    agenda.fase === 'aguardando' && idosos.estado === 'ok' && !idosos.ehIdoso && idosos.idosos.length > 0

  // Editar e Remover nos cartões: idoso e familiar (modo familiar) em pessoal e médico; cuidador só no cuidado que ele criou.
  const acoes: AcoesCompromisso = {
    podeAlterar: (evento) =>
      podeAlterarCompromisso({ evento, ehIdoso: idosos.ehIdoso, tipoPerfil: tipoPerfil ?? idosos.tipoPerfil, idosoId, vinculos }),
    editar: (evento) => {
      setAviso(null)
      setEditando(evento)
    },
    remover: (evento) => {
      setAviso(null)
      setRemovendo(evento)
    },
  }

  function mudarVisao(v: VisaoAgenda) {
    setVisao(v)
    salvarVisaoAgenda('agendaVisao', v)
  }

  return (
    <AcoesCompromissoContext.Provider value={acoes}>
    <section
      aria-labelledby="titulo_agenda"
      className="rounded-3xl border border-[#E5E2F5] bg-white p-4 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
          <CalendarDays size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h2 id="titulo_agenda" className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
            Compromissos
          </h2>
          <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
            Consulte os próximos compromissos e os anteriores.
          </p>
        </div>
        {modo && (
          <button
            type="button"
            onClick={() => {
              setAviso(null)
              setModalAberto(true)
            }}
            disabled={envioBloqueado(idosos, idosoId)}
            className="flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-[#171721] sm:w-auto"
          >
            <Plus size={20} aria-hidden="true" />
            Criar compromisso
          </button>
        )}
      </div>

      {/* Perfil idoso não tem seletor. */}
      {!idosos.ehIdoso && (
        <div className="sm:max-w-xl">
          <SeletorIdoso
            id="idoso_id_agenda"
            valor={idosoId}
            aoMudar={(v) => {
              setIdosoId(v)
              setAviso(null)
            }}
            lista={idosos}
          />
        </div>
      )}

      {escolhaPendente && (
        <p className="mt-5 text-base text-[#56657D] dark:text-[#C7C7D1]">Escolha um idoso para ver a agenda.</p>
      )}

      {agenda.fase === 'carregando' && (
        <p role="status" className={`${CAIXA_INFO} flex items-center gap-3`}>
          <Spinner />
          Carregando a agenda...
        </p>
      )}

      {agenda.fase === 'erro' && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {agenda.erro}
        </p>
      )}

      {aviso && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-base font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {aviso}
        </p>
      )}

      {grupos && (
        <p role="status" className={CAIXA_INFO}>
          {grupos.length === 0
            ? 'Nenhum compromisso na agenda.'
            : `${grupos.reduce((n, g) => n + g.eventos.length, 0)} compromisso(s) encontrado(s).`}
        </p>
      )}
      {grupos && (
        <div className="mt-5">
          <Alternador legenda="Ver como:" nome="visao_agenda" opcoes={VISOES} valor={visao} aoMudar={mudarVisao} />
        </div>
      )}
      {grupos && visao === 'calendario' && (
        <div className="mt-6">
          <Calendario grupos={grupos} />
        </div>
      )}
      {visao === 'lista' && (proximos.length > 0 || passados.length > 0) && (
        <div className="mt-6 space-y-6">
          {passados.length > 0 && (
            <details className="space-y-4 sm:rounded-2xl sm:border sm:border-[#E5E2F5] sm:bg-[#FCFBFF] sm:p-5 sm:dark:border-[#393947] sm:dark:bg-[#1D1D29]">
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

      {modo && (
        <ModalCriarCompromisso
          aberto={modalAberto}
          onFechar={() => setModalAberto(false)}
          modo={modo}
          idosoId={idosos.ehIdoso ? '' : idosoId}
          idosoNome={idosoNome}
          onCriado={() => {
            setModalAberto(false)
            setAviso('Compromisso criado.')
            setVersao((v) => v + 1)
          }}
        />
      )}

      {modo && (
        <ModalCriarCompromisso
          aberto={editando !== null}
          onFechar={() => setEditando(null)}
          modo={modo}
          idosoId={idosos.ehIdoso ? '' : idosoId}
          idosoNome={idosoNome}
          compromisso={editando}
          onCriado={() => {
            setEditando(null)
            setAviso('Compromisso atualizado.')
            setVersao((v) => v + 1)
          }}
        />
      )}

      <ModalConfirmar
        aberto={removendo !== null}
        onFechar={() => setRemovendo(null)}
        titulo="Remover compromisso"
        texto="Remover este compromisso? Esta ação não pode ser desfeita."
        onConfirmar={async () => {
          if (!removendo) return

          await chamarApi(caminhoRegistro('/agenda', idosos.ehIdoso, idosoId, removendo.id), { method: 'DELETE' })

          setRemovendo(null)
          setAviso('Compromisso removido.')
          setVersao((v) => v + 1)
        }}
      />
    </section>
    </AcoesCompromissoContext.Provider>
  )
}

export default function Agenda() {
  useTitulo('Agenda')
  return (
    <div className="flex-1 bg-[#F8F7FF] px-4 py-6 dark:bg-[#0F0F17] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 rounded-3xl border border-[#E5E2F5] bg-white px-5 py-7 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:mb-8 sm:px-8 sm:py-8">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#5F56EC] dark:text-[#A89FFF]">
            Organização e rotina
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">Agenda</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1] sm:text-lg">
            Acompanhe consultas, compromissos pessoais e momentos de cuidado em um só lugar.
          </p>
        </header>
        {/* A agenda ocupa a largura toda: o calendário precisa de espaço. */}
        <div className="min-w-0">
          <AreaAgenda />
        </div>
      </div>
    </div>
  )
}
