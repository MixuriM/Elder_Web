import { useState, type FormEvent } from 'react'
import { HeartPulse } from 'lucide-react'

import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { chamarApi } from '../../lib/chamarApi'
import { envioBloqueado } from '../../lib/regrasIdosoVinculado'
import ModalBase from '../common/ModalBase'
import SeletorIdoso from '../common/SeletorIdoso'
import Spinner from '../common/Spinner'
import CampoSaude from './CampoSaude'

interface ModalRegistrarSaudeProps {
  aberto: boolean
  onFechar: () => void
  // false: o idoso registra a própria leitura (POST /saude). true: familiar ou cuidador registra para um idoso vinculado
  // (POST /saude/idoso/:id), escolhido dentro do modal.
  terceiro: boolean
  onRegistrado: () => void
}

const VAZIO = { idosoId: '', tipoMedicao: '', valor1: '', valor2: '', unidade: '', dataHora: '', observacoes: '' }

function Conteudo({ onFechar, terceiro, onRegistrado }: Omit<ModalRegistrarSaudeProps, 'aberto'>) {
  const idosos = useIdososVinculados()
  const [campos, setCampos] = useState(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return

    setErro(null)
    setEnviando(true)

    try {
      await chamarApi(terceiro ? `/saude/idoso/${campos.idosoId}` : '/saude', {
        method: 'POST',
        body: JSON.stringify({
          tipo_medicao: campos.tipoMedicao,
          valor_1: Number(campos.valor1),
          valor_2: campos.valor2 === '' ? undefined : Number(campos.valor2),
          unidade: campos.unidade,
          data_hora: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
          observacoes: campos.observacoes === '' ? undefined : campos.observacoes,
        }),
      })

      onRegistrado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao registrar leitura de saúde.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase
      aberto
      onFechar={() => {
        if (!enviando) onFechar()
      }}
      icone={<HeartPulse size={22} aria-hidden="true" />}
      sobretitulo={terceiro ? 'Pessoa vinculada' : 'Minha saúde'}
      titulo="Registrar leitura de saúde"
      descricao={
        terceiro
          ? 'Registre uma medição para um idoso vinculado à sua conta.'
          : 'Adicione uma nova medição ao seu histórico.'
      }
    >
      <form onSubmit={registrar} className="space-y-5">
        {terceiro && (
          <SeletorIdoso id="idoso_id_registrar_saude" escrita valor={campos.idosoId} aoMudar={(v) => setCampos((a) => ({ ...a, idosoId: v }))} lista={idosos} />
        )}

        <CampoSaude
          id="registrar-saude-tipo"
          label="Tipo de medição"
          type="text"
          required
          maxLength={50}
          disabled={enviando}
          placeholder={terceiro ? 'Ex.: Glicemia' : 'Ex.: Pressão arterial'}
          value={campos.tipoMedicao}
          onChange={alterar('tipoMedicao')}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoSaude
            id="registrar-saude-valor1"
            label="Valor 1"
            type="number"
            required
            min={0}
            step="any"
            disabled={enviando}
            placeholder="Ex.: 120"
            value={campos.valor1}
            onChange={alterar('valor1')}
          />

          <CampoSaude
            id="registrar-saude-valor2"
            label="Valor 2 (opcional)"
            type="number"
            min={0}
            step="any"
            disabled={enviando}
            placeholder="Ex.: 80"
            value={campos.valor2}
            onChange={alterar('valor2')}
          />
        </div>

        <CampoSaude
          id="registrar-saude-unidade"
          label="Unidade"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={20}
          disabled={enviando}
          placeholder={terceiro ? 'Ex.: mg/dL' : 'Ex.: mmHg'}
          value={campos.unidade}
          onChange={alterar('unidade')}
        />

        <CampoSaude
          id="registrar-saude-data"
          label="Data e hora (opcional)"
          type="datetime-local"
          disabled={enviando}
          value={campos.dataHora}
          onChange={alterar('dataHora')}
        />

        <CampoSaude
          id="registrar-saude-obs"
          label="Observações (opcional)"
          type="text"
          maxLength={300}
          disabled={enviando}
          placeholder="Adicione alguma observação"
          value={campos.observacoes}
          onChange={alterar('observacoes')}
        />

        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          >
            {erro}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="min-h-12 rounded-xl border border-[#D9D7E8] bg-white px-5 py-3 font-semibold text-[#071A38] transition hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA] dark:hover:bg-[#292933]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={enviando || (terceiro && envioBloqueado(idosos, campos.idosoId))}
            aria-busy={enviando}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
          >
            {enviando && <Spinner pequeno />}
            {enviando ? 'Salvando...' : 'Salvar leitura'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Só monta aberto: o formulário nasce vazio a cada abertura.
function ModalRegistrarSaude({ aberto, ...resto }: ModalRegistrarSaudeProps) {
  return aberto ? <Conteudo {...resto} /> : null
}

export default ModalRegistrarSaude
