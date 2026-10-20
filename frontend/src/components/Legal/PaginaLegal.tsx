// Moldura das páginas públicas de Privacidade, Termos e Cookies: sem auth, sem contexto de foto, igual logado ou não.
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import BotaoTema from '../layout/BotaoTema'
import { useTitulo } from '../../hooks/useTitulo'
import { DATA_ATUALIZACAO, DOCUMENTOS_LEGAIS, EMAIL_SUPORTE, VERSAO_DOCUMENTOS } from '../../lib/documentosLegais'

const FOCO =
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#071A38] dark:focus-visible:outline-[#F5F5FA]'
// Link em texto corrido (exceção do alvo de 44 px).
const LINK_TEXTO = `font-semibold text-[#5F56EC] underline underline-offset-4 [overflow-wrap:anywhere] hover:text-[#3F37B5] dark:text-[#B6B0FF] dark:hover:text-[#D4D0FF] ${FOCO}`
const H2 = 'text-2xl font-bold text-[#5F56EC] dark:text-[#B6B0FF]'

export function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className={H2}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

// Em tela estreita cada linha vira um cartão com o nome da coluna visível; os papéis explícitos mantêm a tabela
// para o leitor de tela mesmo com display trocado pelo CSS.
export function Tabela({ legenda, colunas, linhas }: { legenda: string; colunas: string[]; linhas: ReactNode[][] }) {
  return (
    <table role="table" className="block w-full border-collapse text-left text-base md:table">
      <caption className="mb-3 block text-left text-lg font-bold md:table-caption">{legenda}</caption>
      <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
        <tr role="row">
          {colunas.map((c) => (
            <th
              role="columnheader"
              scope="col"
              key={c}
              className="border border-gray-300 bg-[#F3F0FF] p-3 align-top font-bold dark:border-[#454A63] dark:bg-[#1F2130]"
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup" className="block space-y-3 md:table-row-group">
        {linhas.map((linha, i) => (
          <tr
            role="row"
            key={i}
            className="block rounded-xl border border-gray-300 p-4 dark:border-[#454A63] md:table-row md:rounded-none md:border-0 md:p-0"
          >
            {linha.map((celula, j) => (
              <td
                role="cell"
                key={j}
                className="block py-1 align-top [overflow-wrap:anywhere] md:table-cell md:border md:border-gray-300 md:p-3 md:dark:border-[#454A63]"
              >
                <span aria-hidden="true" className="font-bold md:hidden">
                  {colunas[j]}:{' '}
                </span>
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function LinkInterno({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={LINK_TEXTO}>
      {children}
    </Link>
  )
}

export function LinkContato() {
  return (
    <a href={`mailto:${EMAIL_SUPORTE}`} className={LINK_TEXTO}>
      {EMAIL_SUPORTE}
    </a>
  )
}

export function LinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_TEXTO}>
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  )
}

type Props = {
  titulo: string
  resumo: ReactNode[]
  avisoAcademico?: boolean
  children: ReactNode
}

export default function PaginaLegal({ titulo, resumo, avisoAcademico = false, children }: Props) {
  useTitulo(titulo)
  return (
    <div className="min-h-dvh bg-white text-lg text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA]">
      <header className="border-b border-gray-200 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold hover:bg-[#F3F0FF] dark:hover:bg-white/10 ${FOCO}`}
          >
            <ArrowLeft size={22} aria-hidden="true" />
            Página inicial
          </Link>
          <BotaoTema compacto />
        </div>
        <nav aria-label="Documentos legais" className="mx-auto w-full max-w-4xl px-4 pb-3 sm:px-6">
          <ul className="flex flex-wrap gap-2">
            {DOCUMENTOS_LEGAIS.map((d) => (
              <li key={d.caminho}>
                <NavLink
                  to={d.caminho}
                  className={`inline-flex min-h-11 items-center rounded-xl border-2 border-[#5F56EC] px-4 text-base font-semibold text-[#071A38] hover:bg-[#F3F0FF] aria-[current=page]:bg-[#5F56EC] aria-[current=page]:text-white dark:border-[#B6B0FF] dark:text-[#F5F5FA] dark:hover:bg-white/10 dark:aria-[current=page]:bg-[#B6B0FF] dark:aria-[current=page]:text-[#101018] ${FOCO}`}
                >
                  {d.titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 leading-relaxed sm:px-6">
        <div className="space-y-2">
          <h1 className="break-words text-3xl font-bold sm:text-4xl">{titulo}</h1>
          <p className="text-base text-slate-700 dark:text-[#D5D5E0]">
            Versão {VERSAO_DOCUMENTOS}. Última atualização: {DATA_ATUALIZACAO}.
          </p>
          {avisoAcademico && (
            <p className="rounded-xl border-2 border-[#5F56EC] bg-[#F3F0FF] p-4 font-semibold dark:border-[#B6B0FF] dark:bg-[#1F2130]">
              O Elder Web é um projeto acadêmico (TCC) e ainda não é um serviço comercial.
            </p>
          )}
        </div>

        <Secao id="resumo" titulo="Resumo em poucas linhas">
          <Lista itens={resumo} />
        </Secao>

        {children}
      </main>
    </div>
  )
}
