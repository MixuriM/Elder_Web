import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { loginUser, loginWithGoogle, logoutUser } from '../lib/auth'
import { irPara } from '../lib/recarregar'
import { useTitulo } from '../hooks/useTitulo'
import { buscarEstadoDemo, entrarComoDemo, ROTULO_PERFIL, type ContaDemo } from '../services/demoService'

// Modo demonstração (D7, docs/modo-demonstracao.md): rota pública, fora do menu e sem link em lugar nenhum. Antes do
// login não fala em demonstração; com o modo desligado ou quem não é admin, o backend responde 404 e a tela mostra
// "não encontrada" e sai da conta. Não chama /auth/sync: o admin não tem linha em Usuario.
const GRUPOS: ContaDemo['tipo_perfil'][] = ['idoso', 'cuidador', 'familiar']

const CAMPO =
  'min-h-12 w-full rounded-xl border-2 border-[#C9C5E8] bg-white px-4 py-2 text-base text-[#071A38] focus:border-[#5F56EC] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/30 dark:border-[#393947] dark:bg-[#181824] dark:text-[#F5F5FA]'
const ROTULO = 'mb-2 block text-lg font-semibold text-[#071A38] dark:text-[#F5F5FA]'
const PRIMARIO =
  'flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5F56EC] px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-[#554CD8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60'
const SECUNDARIO =
  'flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-[#5F56EC] bg-white px-6 py-3 text-lg font-bold text-[#5F56EC] transition-colors hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#A89FFF] dark:bg-transparent dark:text-[#A89FFF] dark:hover:bg-[#292933]'
const ERRO = 'rounded-xl border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-base font-semibold text-[#7A271A] dark:border-[#7A271A] dark:bg-[#2A1215] dark:text-[#FECDCA]'

export default function Demo() {
  const [etapa, setEtapa] = useState<'login' | 'contas' | 'nao_encontrada'>('login')
  const [contas, setContas] = useState<ContaDemo[]>([])
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  useTitulo(etapa === 'contas' ? 'Modo demonstração' : etapa === 'nao_encontrada' ? 'Página não encontrada' : 'Acesso restrito')

  async function entrar(login: () => Promise<unknown>) {
    setErro(null)
    setCarregando(true)
    try {
      await login()
    } catch {
      setErro('Não foi possível entrar.')
      setCarregando(false)
      return
    }
    try {
      const estado = await buscarEstadoDemo()
      setContas(estado.contas)
      setEtapa('contas')
    } catch {
      // 404 (modo desligado ou não é admin) e qualquer outra falha: não revela que a página existe.
      await logoutUser().catch(() => undefined)
      setEtapa('nao_encontrada')
    }
    setCarregando(false)
  }

  async function escolher(slug: string) {
    setErro(null)
    setCarregando(true)
    try {
      await entrarComoDemo(slug)
      irPara('/Home')
    } catch {
      setErro('Não foi possível entrar nessa conta. Tente de novo.')
      setCarregando(false)
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    entrar(() => loginUser(email, senha))
  }

  return (
    <main className="min-h-dvh bg-white px-4 py-10 font-['Atkinson_Hyperlegible'] text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA] sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {etapa === 'nao_encontrada' && (
          <>
            <h1 className="text-3xl font-bold">Página não encontrada</h1>
            <p className="text-lg">O endereço que você abriu não existe.</p>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-lg font-bold text-[#5F56EC] underline underline-offset-4 dark:text-[#A89FFF]"
            >
              Ir para o início
            </Link>
          </>
        )}

        {etapa === 'login' && (
          <>
            <h1 className="text-3xl font-bold">Acesso restrito</h1>
            <form onSubmit={enviar} className="flex flex-col gap-5">
              <div>
                <label htmlFor="demo-email" className={ROTULO}>
                  E-mail
                </label>
                <input id="demo-email" type="email" autoComplete="username" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="demo-senha" className={ROTULO}>
                  Senha
                </label>
                <input id="demo-senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={CAMPO} />
              </div>
              {erro && (
                <p role="alert" className={ERRO}>
                  {erro}
                </p>
              )}
              <button type="submit" disabled={carregando} aria-busy={carregando} className={PRIMARIO}>
                Entrar
              </button>
            </form>
            <button type="button" disabled={carregando} onClick={() => entrar(loginWithGoogle)} className={SECUNDARIO}>
              Entrar com Google
            </button>
          </>
        )}

        {etapa === 'contas' && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold">Modo demonstração</h1>
              <p className="rounded-xl border-2 border-[#F5C26B] bg-[#FFF7E6] px-4 py-3 text-lg font-bold text-[#5C3B00] dark:border-[#7A5A1A] dark:bg-[#2A2112] dark:text-[#FCE7B2]">
                Todos os dados são fictícios.
              </p>
              <p className="text-lg">Escolha a conta para entrar.</p>
            </div>
            {erro && (
              <p role="alert" className={ERRO}>
                {erro}
              </p>
            )}
            {GRUPOS.map((perfil) => (
              <section key={perfil} aria-labelledby={`grupo-${perfil}`} className="flex flex-col gap-3">
                <h2 id={`grupo-${perfil}`} className="text-2xl font-bold">
                  {ROTULO_PERFIL[perfil]}
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {contas
                    .filter((c) => c.tipo_perfil === perfil)
                    .map((c) => (
                      <li key={c.slug}>
                        <button
                          type="button"
                          disabled={carregando}
                          onClick={() => escolher(c.slug)}
                          className="flex min-h-11 w-full flex-col items-start gap-1 rounded-2xl border-2 border-[#E5E2F5] bg-white px-4 py-3 text-left transition-colors hover:border-[#5F56EC] hover:bg-[#F7F5FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#393947] dark:bg-[#181824] dark:hover:border-[#A89FFF] dark:hover:bg-[#20202A]"
                        >
                          <span className="text-lg font-bold text-[#5F56EC] dark:text-[#A89FFF]">{c.nome}</span>
                          <span className="text-base font-semibold">{ROTULO_PERFIL[c.tipo_perfil]}</span>
                          <span className="text-base text-[#3B4A63] dark:text-[#C7C7D1]">{c.descricao}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
