
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { EMAIL_SUPORTE } from '../../lib/documentosLegais'

const FOCO =
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#5F56EC] dark:focus-visible:outline-[#B6B0FF]'

const LINK_TEXTO = `
  font-semibold text-[#5F56EC] underline
  underline-offset-4 [overflow-wrap:anywhere]
  hover:text-[#3F37B5]
  dark:text-[#B6B0FF]
  dark:hover:text-[#D4D0FF]
  ${FOCO}
`

// SEÇÕES DOS DOCUMENTOS
export function Secao({
  id,
  titulo,
  children,
}: {
  id: string
  titulo: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="scroll-mt-24 space-y-4"
    >
      <h3
        id={id}
        className="
          text-xl font-bold text-[#5F56EC]
          sm:text-2xl dark:text-[#B6B0FF]
        "
      >
        {titulo}
      </h3>

      <div className="space-y-4 text-slate-700 dark:text-[#D5D5E0]">
        {children}
      </div>
    </section>
  )
}

// LISTAS
export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-3 pl-6 marker:text-[#7C70E8]">
      {itens.map((item, index) => (
        <li key={index} className="pl-1">
          {item}
        </li>
      ))}
    </ul>
  )
}

// TABELAS RESPONSIVAS
export function Tabela({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string
  colunas: string[]
  linhas: ReactNode[][]
}) {
  return (
    <div className="w-full min-w-0">
      <table className="w-full border-collapse text-left text-base">
        <caption className="mb-4 text-left text-lg font-bold">
          {legenda}
        </caption>

        <thead className="sr-only md:not-sr-only">
          <tr>
            {colunas.map((coluna, index) => (
              <th
                key={index}
                scope="col"
                className="
                  border border-[#DDD8F5]
                  bg-[#F3F0FF] p-3
                  dark:border-[#454A63]
                  dark:bg-[#25243B]
                "
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="block space-y-3 md:table-row-group md:space-y-0">
          {linhas.map((linha, index) => (
            <tr
              key={index}
              className="
                block rounded-xl border border-[#DDD8F5]
                p-4 md:table-row md:rounded-none
                md:border-0 md:p-0
                dark:border-[#454A63]
              "
            >
              {linha.map((celula, colunaIndex) => (
                <td
                  key={colunaIndex}
                  className="
                    block py-2 align-top
                    [overflow-wrap:anywhere]
                    md:table-cell md:border
                    md:border-[#DDD8F5] md:p-3
                    md:dark:border-[#454A63]
                  "
                >
                  <span
                    aria-hidden="true"
                    className="font-bold md:hidden"
                  >
                    {colunas[colunaIndex]}:{' '}
                  </span>

                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// LINKS INTERNOS
export function LinkInterno({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={LINK_TEXTO}>
      {children}
    </Link>
  )
}

// CONTATO
export function LinkContato() {
  return (
    <a
      href={`mailto:${EMAIL_SUPORTE}`}
      className={LINK_TEXTO}
    >
      {EMAIL_SUPORTE}
    </a>
  )
}

// LINKS EXTERNOS
export function LinkExterno({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_TEXTO}
    >
      {children}
      <span className="sr-only">
        {' '}(abre em nova aba)
      </span>
    </a>
  )
}
