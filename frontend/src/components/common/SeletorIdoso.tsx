import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import type { IdososVinculados } from '../../hooks/useIdososVinculados'
import Spinner from './Spinner'

interface SeletorIdosoProps {
  id: string
  valor: string
  aoMudar: (valor: string) => void
  lista: IdososVinculados
  label?: string
  // Tela de escrita: com 2+ idosos não pré-seleciona o primeiro (evita gravar no idoso errado).
  escrita?: boolean
  // Esta prop existe só porque /alimentacao ainda não tem tema escuro: o <html> mantém .dark ao navegar de uma
  // tela escura, e as classes dark: deixariam o rótulo quase branco sobre o fundo branco da página.
  // Remover a prop (e o `tema()` abaixo) quando a página de Alimentação ganhar tema escuro.
  semTemaEscuro?: boolean
}

const CLASSE_AVISO =
  'rounded-xl border border-[#E5E2F5] bg-[#F8F7FC] p-4 text-base text-[#071A38] dark:border-[#393947] dark:bg-[#1C1C27] dark:text-[#F5F5FA]'

// O id do idoso é só o value do select: nunca aparece nem é digitável.
// Perfil idoso não tem seletor (usa os endpoints sem ID).
function SeletorIdoso({
  id,
  valor,
  aoMudar,
  lista,
  label = 'Idoso',
  escrita = false,
  semTemaEscuro = false,
}: SeletorIdosoProps) {
  const { estado, ehIdoso, idosos } = lista

  const exigeEscolha = escrita && idosos.length > 1

  const tema = (classes: string) =>
    semTemaEscuro ? classes.split(' ').filter((c) => !c.startsWith('dark:')).join(' ') : classes

  // Leitura (ou 1 idoso só): o select não tem opção vazia, então o estado precisa bater com a primeira opção.
  useEffect(() => {
    if (
      estado === 'ok' &&
      !ehIdoso &&
      !exigeEscolha &&
      idosos.length > 0 &&
      !idosos.some((i) => String(i.id) === valor)
    ) {
      aoMudar(String(idosos[0].id))
    }
  }, [estado, ehIdoso, exigeEscolha, idosos, valor, aoMudar])

  if (ehIdoso) return null

  if (estado === 'carregando') {
    return (
      <div role="status" className={`flex items-center gap-3 ${tema(CLASSE_AVISO)}`}>
        <Spinner />
        <span>Carregando idosos vinculados...</span>
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div
        role="alert"
        className={tema(
          'rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',
        )}
      >
        Não foi possível carregar os idosos vinculados. Tente novamente mais tarde.
      </div>
    )
  }

  if (idosos.length === 0) {
    return (
      <div role="status" className={tema(CLASSE_AVISO)}>
        Você ainda não tem nenhum idoso vinculado.{' '}
        <Link
          to="/vinculos"
          className={tema(
            'font-semibold text-[#554CD8] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC] dark:text-[#B6B0FF] dark:focus-visible:ring-[#A89FFF]',
          )}
        >
          Solicite um vínculo
        </Link>{' '}
        para continuar.
      </div>
    )
  }

  return (
    <div className="w-full space-y-2">
      <label
        htmlFor={id}
        className={tema('block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA] sm:text-lg')}
      >
        {label}
      </label>

      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={escrita}
        className={tema(
          'min-h-[56px] w-full rounded-xl border border-[#D9D7E8] bg-white px-4 py-3 text-base text-[#071A38] outline-none transition-all duration-200 hover:border-[#B9B4D6] focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/15 dark:border-[#3B3B49] dark:bg-[#171721] dark:text-[#F5F5FA] dark:hover:border-[#555565] dark:focus:border-[#9B96FF] dark:focus:ring-[#9B96FF]/20 sm:text-lg',
        )}
      >
        {exigeEscolha && (
          <option value="" disabled>
            Selecione o idoso
          </option>
        )}
        {idosos.map((i) => (
          <option key={i.id} value={String(i.id)}>
            {i.email_mascarado ? `${i.nome} (${i.email_mascarado})` : i.nome}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SeletorIdoso
