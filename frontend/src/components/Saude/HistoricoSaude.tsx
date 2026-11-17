import { useState } from 'react'
import { HeartPulse } from 'lucide-react'

import { useAcesso } from '../../contexts/useAcesso'
import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { chamarApi } from '../../lib/chamarApi'
import { podeAlterarRegistroSaude } from '../../lib/permissoesEdicao'
import { caminhoRegistro, useRegistrosDoIdoso } from '../../lib/registrosDoIdoso'
import { mensagemPorStatus } from '../Vinculos/mensagensVinculo'
import ModalConfirmar from '../common/ModalConfirmar'
import EstadoVazio from '../common/EstadoVazio'
import SeletorIdoso from '../common/SeletorIdoso'
import Spinner from '../common/Spinner'
import ModalEditarSaude, { type RegistroSaudeLista } from './ModalEditarSaude'

const BASE = '/saude'

// Mensagem fixa por status: o corpo do erro nunca é exibido (RNF-001).
const mensagemErroHistorico = (erro: unknown) =>
  mensagemPorStatus(
    erro,
    {
      401: 'Sessão expirada. Entre novamente.',
      403: 'Você não tem permissão para ver este histórico de saúde.',
    },
    'Não foi possível carregar o histórico de saúde.',
  )

const BOTAO =
  'min-h-[44px] w-full rounded-xl border px-3 py-2.5 font-semibold transition sm:w-auto sm:px-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60'

type Props = {
  // Botão do cartão de lista vazia; ausente quando a pessoa não registra (cuidador sem permissão, por exemplo).
  onAdicionar?: () => void
  // Contador da tela pai: muda quando um registro novo é criado, e a lista recarrega.
  versao?: number
  // Cuidador só altera com a permissão de registrar saúde. Padrão aberto: o 403 do servidor é a barreira real.
  escritaTerceiros?: boolean
}

function HistoricoSaude({ versao = 0, escritaTerceiros = true, onAdicionar }: Props) {
  const idosos = useIdososVinculados()
  const { vinculos } = useAcesso()

  const [idosoId, setIdosoId] = useState('')
  const [versaoLocal, setVersaoLocal] = useState(0)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [editando, setEditando] = useState<RegistroSaudeLista | null>(null)
  const [removendo, setRemovendo] = useState<RegistroSaudeLista | null>(null)

  const lista = useRegistrosDoIdoso<RegistroSaudeLista>({
    base: BASE,
    idosos,
    idosoId,
    versao: versao + versaoLocal,
    mensagemErro: mensagemErroHistorico,
  })

  const podeAlterar = (registro: RegistroSaudeLista) =>
    podeAlterarRegistroSaude({
      ehIdoso: idosos.ehIdoso,
      tipoPerfil: idosos.tipoPerfil,
      idosoId,
      vinculos,
      escritaTerceiros,
      registradoPorId: registro.registrado_por_id,
    })

  const caminhoDe = (registro: RegistroSaudeLista) => caminhoRegistro(BASE, idosos.ehIdoso, idosoId, registro.id)

  const recarregar = () => setVersaoLocal((v) => v + 1)

  const escolhaPendente =
    lista.fase === 'aguardando' && idosos.estado === 'ok' && !idosos.ehIdoso && idosos.idosos.length > 0

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

        <h2 className="mt-2 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">Histórico de saúde</h2>

        <p className="mt-2 text-[#56657D] dark:text-[#C7C7D1]">Consulte as medições registradas.</p>
      </div>

      <SeletorIdoso
        id="idoso_id_historico"
        valor={idosoId}
        aoMudar={(valor) => {
          setIdosoId(valor)
          setSucesso(null)
        }}
        lista={idosos}
      />

      {escolhaPendente && (
        <p className="mt-5 text-base text-[#56657D] dark:text-[#C7C7D1]">Escolha um idoso para ver o histórico.</p>
      )}

      {lista.fase === 'carregando' && (
        <p
          role="status"
          className="mt-5 flex items-center gap-3 rounded-xl border border-[#E5E2F5] bg-[#F8F7FC] p-4 text-[#071A38] dark:border-[#393947] dark:bg-[#1C1C27] dark:text-[#F5F5FA]"
        >
          <Spinner />
          Carregando o histórico de saúde...
        </p>
      )}

      {lista.fase === 'erro' && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          {lista.erro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300"
        >
          {sucesso}
        </div>
      )}

      {lista.registros && lista.registros.length === 0 && (
        <EstadoVazio
          icone={<HeartPulse size={30} aria-hidden="true" />}
          titulo="Nenhum registro de saúde"
          texto={
            onAdicionar
              ? 'Registre a primeira medição para começar a acompanhar o histórico.'
              : 'Quando uma medição for registrada, ela aparece aqui.'
          }
          rotuloBotao={onAdicionar ? 'Registrar leitura' : undefined}
          onClick={onAdicionar}
        />
      )}

      {lista.registros && lista.registros.length > 0 && (
        <div className="mt-7 space-y-3">
          {lista.registros.map((registro) => (
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
              <h3 className="min-w-0 break-words font-bold [overflow-wrap:anywhere] text-[#071A38] dark:text-[#F5F5FA]">
                {registro.tipo_medicao}
              </h3>

              <p className="mt-3 text-2xl font-bold [overflow-wrap:anywhere] text-[#071A38] dark:text-[#F5F5FA]">
                {registro.valor_1}

                {registro.valor_2 !== null ? ` / ${registro.valor_2}` : ''}

                <span className="ml-2 text-base font-medium text-[#56657D] dark:text-[#C7C7D1]">
                  {registro.unidade}
                </span>
              </p>

              <p className="mt-3 border-t border-[#ECEAF4] pt-3 text-sm text-[#56657D] dark:border-[#34343F] dark:text-[#AFAFBD]">
                {new Date(registro.data_hora).toLocaleString('pt-BR')}
              </p>

              {registro.observacoes && (
                <p className="mt-3 whitespace-pre-line break-words text-sm [overflow-wrap:anywhere] text-[#56657D] dark:text-[#C7C7D1]">
                  <span className="font-semibold">Observações:</span> {registro.observacoes}
                </p>
              )}

              {podeAlterar(registro) && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    aria-label={`Editar registro de ${registro.tipo_medicao}`}
                    onClick={() => {
                      setSucesso(null)
                      setEditando(registro)
                    }}
                    className={`${BOTAO} border-[#5F56EC] text-[#5F56EC] hover:bg-[#5F56EC]/10 focus-visible:outline-[#5F56EC] dark:border-[#9B96FF] dark:text-[#9B96FF]`}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    aria-label={`Remover registro de ${registro.tipo_medicao}`}
                    onClick={() => {
                      setSucesso(null)
                      setRemovendo(registro)
                    }}
                    className={`${BOTAO} border-red-700 text-red-700 hover:bg-red-700/10 focus-visible:outline-red-700 dark:border-red-400 dark:text-red-300`}
                  >
                    Remover
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <ModalEditarSaude
        registro={editando}
        caminho={editando ? caminhoDe(editando) : ''}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null)
          setSucesso('Registro de saúde atualizado com sucesso!')
          recarregar()
        }}
      />

      <ModalConfirmar
        aberto={removendo !== null}
        onFechar={() => setRemovendo(null)}
        texto="Remover este registro? Esta ação não pode ser desfeita."
        onConfirmar={async () => {
          if (!removendo) return

          await chamarApi(caminhoDe(removendo), { method: 'DELETE' })

          setRemovendo(null)
          setSucesso('Registro removido.')
          recarregar()
        }}
      />
    </section>
  )
}

export default HistoricoSaude
