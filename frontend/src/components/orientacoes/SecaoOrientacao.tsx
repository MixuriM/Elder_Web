
import type { ReactNode } from 'react'
import type { IconeOrientacao } from './dadosOrientacoes'

import {
  cardOrientacao,
  cardAjuda,
  iconeOrientacao,
  numeroOrientacao,
  tituloSecao,
  textoOrientacao,
} from './estilosOrientacoes'

interface SecaoOrientacaoProps {
  id: string
  titulo: string
  children: ReactNode
  icone?: IconeOrientacao
  numero?: number
}

function IconeSecao({ tipo }: { tipo: IconeOrientacao }) {
  const icones: Record<IconeOrientacao, ReactNode> = {
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),

    cadeado: (
      <>
        <rect
          x="5"
          y="10"
          width="14"
          height="11"
          rx="2"
        />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),

    usuarios: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2" />
        <path d="M16 5a3 3 0 0 1 0 6" />
        <path d="M18 14a5 5 0 0 1 3 5v1" />
      </>
    ),

    saude: (
      <>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
        <path d="M7 12h3l2-3 2 6 2-3h2" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      {icones[tipo]}
    </svg>
  )
}

export default function SecaoOrientacao({
  id,
  titulo,
  children,
  icone,
  numero,
}: SecaoOrientacaoProps) {
  const ehAjuda = id === 'ajuda'

  return (
    <section
      aria-labelledby={id}
      className={ehAjuda ? cardAjuda : cardOrientacao}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-5">
          {/* Ícone da orientação */}
          {icone && (
            <div
              className={iconeOrientacao}
              aria-hidden="true"
            >
              <IconeSecao tipo={icone} />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            {/* Número da orientação */}
            {numero !== undefined && (
              <span
                aria-hidden="true"
                className={numeroOrientacao}
              >
                {String(numero).padStart(2, '0')}
              </span>
            )}

            {/* Título da seção */}
            <h2
              id={id}
              className={tituloSecao}
            >
              {titulo}
            </h2>

            {/* Conteúdo da seção */}
            <div
              className={`min-w-0 space-y-3 ${textoOrientacao}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
