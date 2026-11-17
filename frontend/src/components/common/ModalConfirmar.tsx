import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import { mensagemRemocao } from '../../lib/mensagensAcaoRegistro'
import ModalBase from './ModalBase'
import Spinner from './Spinner'

interface ModalConfirmarProps {
  aberto: boolean
  onFechar: () => void
  texto: string
  // Sucesso: a tela fecha o modal e recarrega a lista. Rejeitar mostra a mensagem fixa por status.
  onConfirmar: () => Promise<void>
  titulo?: string
}

function Conteudo({ onFechar, texto, onConfirmar, titulo }: Omit<ModalConfirmarProps, 'aberto'>) {
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setErro(null)
    setRemovendo(true)
    try {
      await onConfirmar()
    } catch (err) {
      setErro(mensagemRemocao(err))
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <ModalBase
      aberto
      estreito
      papel="alertdialog"
      onFechar={() => {
        if (!removendo) onFechar()
      }}
      icone={<Trash2 size={22} aria-hidden="true" />}
      sobretitulo="Atenção"
      titulo={titulo ?? 'Remover registro'}
      descricao="Confirme antes de continuar."
    >
      <p className="text-base leading-relaxed text-[#071A38] dark:text-[#F5F5FA]">{texto}</p>

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          {erro}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onFechar}
          disabled={removendo}
          className="min-h-12 rounded-xl border border-[#D9D7E8] bg-white px-5 py-3 font-semibold text-[#071A38] transition hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA] dark:hover:bg-[#292933]"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={removendo}
          aria-busy={removendo}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-semibold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
        >
          {removendo && <Spinner />}
          {removendo ? 'Removendo...' : 'Remover'}
        </button>
      </div>
    </ModalBase>
  )
}

// Só monta aberto: o estado (erro, removendo) nasce limpo a cada abertura.
function ModalConfirmar({ aberto, ...resto }: ModalConfirmarProps) {
  return aberto ? <Conteudo {...resto} /> : null
}

export default ModalConfirmar
