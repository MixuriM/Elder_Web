import { useState } from 'react'
import { ClipboardList, Utensils } from 'lucide-react'

import { useAcesso } from '../../contexts/useAcesso'
import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { formatarDataHora, rotuloRefeicao } from '../../lib/alimentacaoFormato'
import { chamarApi } from '../../lib/chamarApi'
import { podeAlterarOutroRegistro } from '../../lib/permissoesEdicao'
import { caminhoRegistro, useRegistrosDoIdoso } from '../../lib/registrosDoIdoso'
import { mensagemPorStatus } from '../Vinculos/mensagensVinculo'
import ModalConfirmar from '../common/ModalConfirmar'
import EstadoVazio from '../common/EstadoVazio'
import SeletorIdoso from '../common/SeletorIdoso'
import Spinner from '../common/Spinner'
import ModalEditarRefeicao, { type RefeicaoParaEditar } from './ModalEditarRefeicao'

const BASE = '/alimentacao'

type RegistroApi = { id: number; refeicao: string; descricao: string; data_hora: string }
type Refeicao = RefeicaoParaEditar & { rotulo: string; texto: string }

// Formata tudo antes de exibir: um registro inválido lança RangeError e vira erro, nunca lista pela metade.
const transformar = (registros: unknown[]): Refeicao[] =>
  (registros as RegistroApi[]).map((r) => ({
    id: r.id,
    refeicao: r.refeicao,
    descricao: r.descricao,
    iso: r.data_hora,
    rotulo: rotuloRefeicao(r.refeicao),
    texto: formatarDataHora(r.data_hora),
  }))

// Mensagem fixa por status: o corpo do erro nunca é exibido (a descrição pode revelar dado de saúde, RNF-001).
const mensagemErroHistorico = (erro: unknown) =>
  erro instanceof RangeError
    ? 'Não foi possível exibir o histórico alimentar.'
    : mensagemPorStatus(
        erro,
        {
          400: 'Id de idoso inválido.',
          401: 'Sessão expirada. Entre novamente.',
          403: 'Você não tem permissão para ver este histórico alimentar.',
        },
        'Não foi possível carregar o histórico alimentar.',
      )

const BOTAO =
  'min-h-11 w-full rounded-xl border px-3 py-2.5 font-semibold transition sm:w-auto sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]'

const CAIXA_INFO =
  'mt-4 rounded-xl border border-[#E5E2F5] bg-[#F8F7FF] p-4 text-base font-medium text-[#071A38] dark:border-[#393947] dark:bg-[#20202D] dark:text-[#F5F5FA]'

type Props = {
  // Botão do cartão de lista vazia; ausente quando a pessoa não registra (cuidador).
  onAdicionar?: () => void
  // Contador da tela pai: muda quando uma refeição nova é registrada, e a lista recarrega.
  versao?: number
}

// Item 7.2 (RF-019) e Fase 11: histórico alimentar que carrega sozinho, com Editar e Remover.
export default function HistoricoAlimentar({ versao = 0, onAdicionar }: Props) {
  const idosos = useIdososVinculados()
  const { vinculos } = useAcesso()

  const [idosoId, setIdosoId] = useState('')
  const [versaoLocal, setVersaoLocal] = useState(0)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [editando, setEditando] = useState<Refeicao | null>(null)
  const [removendo, setRemovendo] = useState<Refeicao | null>(null)

  const lista = useRegistrosDoIdoso<Refeicao>({
    base: BASE,
    idosos,
    idosoId,
    versao: versao + versaoLocal,
    mensagemErro: mensagemErroHistorico,
    transformar,
  })

  // Idoso sempre; familiar só com modo familiar; cuidador nunca. O 403 do servidor é a barreira real.
  const podeAlterar = podeAlterarOutroRegistro({ ehIdoso: idosos.ehIdoso, tipoPerfil: idosos.tipoPerfil, idosoId, vinculos })

  const caminhoDe = (registro: Refeicao) => caminhoRegistro(BASE, idosos.ehIdoso, idosoId, registro.id)

  const escolhaPendente =
    lista.fase === 'aguardando' && idosos.estado === 'ok' && !idosos.ehIdoso && idosos.idosos.length > 0

  return (
    <section
      aria-labelledby="titulo_historico_alimentar"
      className="rounded-3xl border border-[#E5E2F5] bg-white p-4 shadow-sm dark:border-[#393947] dark:bg-[#171721] sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#5F56EC] dark:bg-[#29263D] dark:text-[#A89FFF]">
          <ClipboardList size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h2
            id="titulo_historico_alimentar"
            className="text-xl font-bold leading-snug text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl"
          >
            Histórico alimentar
          </h2>
          <p className="mt-1 text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
            Consulte as refeições registradas para você ou para uma pessoa vinculada.
          </p>
        </div>
      </div>

      <SeletorIdoso
        id="idoso_id_historico_alimentar"
        valor={idosoId}
        aoMudar={(valor) => {
          setIdosoId(valor)
          setSucesso(null)
        }}
        lista={idosos}
      />

      {escolhaPendente && (
        <p className="mt-4 text-base text-[#56657D] dark:text-[#C7C7D1]">Escolha um idoso para ver o histórico.</p>
      )}

      {lista.fase === 'erro' && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {lista.erro}
        </p>
      )}

      {lista.fase === 'carregando' && (
        <p role="status" className={`${CAIXA_INFO} flex items-center gap-3`}>
          <Spinner />
          Carregando o histórico alimentar...
        </p>
      )}

      {sucesso && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-base font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {sucesso}
        </p>
      )}

      {lista.registros && lista.registros.length === 0 && (
        <EstadoVazio
          icone={<Utensils size={30} aria-hidden="true" />}
          titulo="Nenhuma refeição registrada"
          texto={
            onAdicionar
              ? 'Registre a primeira refeição para começar a acompanhar o histórico alimentar.'
              : 'Quando uma refeição for registrada, ela aparece aqui.'
          }
          rotuloBotao={onAdicionar ? 'Registrar refeição' : undefined}
          onClick={onAdicionar}
        />
      )}

      {lista.registros && lista.registros.length > 0 && (
        <p role="status" className={CAIXA_INFO}>
          {`${lista.registros.length} registro(s) encontrado(s).`}
        </p>
      )}

      {lista.registros && lista.registros.length > 0 && (
        <ul className="mt-5 space-y-3">
          {lista.registros.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[#E5E2F5] bg-[#F8F7FF] p-3 dark:border-[#393947] dark:bg-[#20202D] sm:p-4"
            >
              <p className="font-bold text-[#071A38] dark:text-[#F5F5FA]">
                <strong>{r.rotulo}</strong>
              </p>
              <time dateTime={r.iso} className="mt-1 block text-sm font-medium text-[#5F56EC] dark:text-[#A89FFF]">
                {r.texto}
              </time>
              <p className="mt-2 break-words text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">
                {r.descricao}
              </p>

              {podeAlterar && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    aria-label={`Editar refeição ${r.rotulo}`}
                    onClick={() => {
                      setSucesso(null)
                      setEditando(r)
                    }}
                    className={`${BOTAO} border-[#5F56EC] text-[#5F56EC] hover:bg-[#5F56EC]/10 focus-visible:ring-[#5F56EC]/40 dark:border-[#A89FFF] dark:text-[#A89FFF]`}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    aria-label={`Remover refeição ${r.rotulo}`}
                    onClick={() => {
                      setSucesso(null)
                      setRemovendo(r)
                    }}
                    className={`${BOTAO} border-red-700 text-red-700 hover:bg-red-700/10 focus-visible:ring-red-700/40 dark:border-red-400 dark:text-red-300`}
                  >
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ModalEditarRefeicao
        registro={editando}
        caminho={editando ? caminhoDe(editando) : ''}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null)
          setSucesso('Refeição atualizada.')
          setVersaoLocal((v) => v + 1)
        }}
      />

      <ModalConfirmar
        aberto={removendo !== null}
        onFechar={() => setRemovendo(null)}
        titulo="Remover refeição"
        texto="Remover este registro? Esta ação não pode ser desfeita."
        onConfirmar={async () => {
          if (!removendo) return

          await chamarApi(caminhoDe(removendo), { method: 'DELETE' })

          setRemovendo(null)
          setSucesso('Refeição removida.')
          setVersaoLocal((v) => v + 1)
        }}
      />
    </section>
  )
}
