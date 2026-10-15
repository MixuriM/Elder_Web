import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'

import { useModoDemo } from '../../hooks/useModoDemo'
import { logoutUser } from '../../lib/auth'
import { irPara, recarregarPagina } from '../../lib/recarregar'
import { buscarEstadoDemo, entrarComoDemo, restaurarDemo, ROTULO_PERFIL, type ContaDemo } from '../../services/demoService'

const BOTAO_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-[#5F56EC] px-4 py-2 text-base font-bold text-white transition-colors hover:bg-[#554CD8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60'
const BOTAO_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[#5F56EC] bg-white px-4 py-2 text-base font-bold text-[#5F56EC] transition-colors hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#A89FFF] dark:bg-transparent dark:text-[#A89FFF] dark:hover:bg-[#292933]'

const CONTA = "border-[#5F56EC] bg-white text-[#5F56EC] hover:bg-[#F3F0FF] disabled:opacity-60 dark:border-[#A89FFF] dark:bg-transparent dark:text-[#A89FFF] dark:hover:bg-[#292933]"
const CONTA_ATUAL = "border-[#5F56EC] bg-[#5F56EC] text-white"

// Modo demonstração (D7): faixa acima da moldura, em fluxo normal (nunca fixa: em 320 px cobriria o conteúdo). O aviso de
// dados fictícios fica sempre visível; troca de conta, restaurar e sair ficam num <details> recolhido.
export default function BarraDemonstracao() {
  const demo = useModoDemo()
  const [estado, setEstado] = useState<{ contas: ContaDemo[]; atual: string | null } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!demo) return
    let vivo = true
    buscarEstadoDemo()
      .then((e) => vivo && setEstado(e))
      // Modo desligado no meio da sessão: sem lista de contas, sobra o aviso e o botão de sair.
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [demo])

  if (!demo) return null

  async function agir(acao: () => Promise<void>) {
    setErro(null)
    setOcupado(true)
    try {
      await acao()
    } catch {
      setErro('Não foi possível concluir. Tente de novo.')
      setOcupado(false)
    }
  }

  return (
    <section
      aria-label="Modo demonstração"
      className="border-b-2 border-[#F5C26B] bg-[#FFF7E6] text-[#5C3B00] dark:border-[#7A5A1A] dark:bg-[#2A2112] dark:text-[#FCE7B2]"
    >
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-1 px-4 py-2">
        <p className="flex items-start gap-2 text-base font-bold">
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          Modo demonstração: todos os dados são fictícios
        </p>
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg text-base font-semibold underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40">
            Trocar de conta ou restaurar
          </summary>
          <div className="flex flex-col gap-3 pb-2 pt-1">
            {estado && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {estado.contas.map((c) => {
                  const atual = c.slug === estado.atual
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        aria-current={atual ? 'true' : undefined}
                        disabled={ocupado || atual}
                        onClick={() => agir(async () => {
                          await entrarComoDemo(c.slug)
                          irPara('/Home')
                        })}
                        className={`${atual ? CONTA_ATUAL : CONTA} flex min-h-11 w-full flex-col items-start rounded-xl border-2 px-4 py-2 text-left text-base font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed`}
                      >
                        <span>{c.nome}</span>
                        <span className="text-sm font-semibold">
                          {ROTULO_PERFIL[c.tipo_perfil]}
                          {atual ? ', conta atual' : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => agir(async () => {
                  await restaurarDemo()
                  recarregarPagina()
                })}
                className={BOTAO_PRIMARIO}
              >
                Restaurar dados
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => agir(async () => {
                  await logoutUser()
                  irPara('/demo')
                })}
                className={BOTAO_SECUNDARIO}
              >
                Sair da demonstração
              </button>
            </div>
            <p className="text-base">Pedir vínculo, aceitar convite e cadastrar idoso não funcionam neste modo.</p>
            {erro && (
              <p role="alert" className="text-base font-semibold">
                {erro}
              </p>
            )}
          </div>
        </details>
      </div>
    </section>
  )
}
