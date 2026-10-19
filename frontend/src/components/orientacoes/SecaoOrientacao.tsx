
import type { ReactNode } from 'react'
import { tituloSecao } from './estilosOrientacoes'

interface SecaoOrientacaoProps {
  id: string
  titulo: string
  children: ReactNode
}

export default function SecaoOrientacao({
  id,
  titulo,
  children,
}: SecaoOrientacaoProps) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className={tituloSecao}>
        {titulo}
      </h2>

      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}
