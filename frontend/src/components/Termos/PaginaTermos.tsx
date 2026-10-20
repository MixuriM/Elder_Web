import type { ReactNode } from 'react'

import TermosHero from './TermosHero'
import TermosResumo from './TermosResumo'
import TermosNavegacao from './TermosNavegacao'
import TermosAviso from './TermosAviso'

interface PaginaTermosProps {
  children: ReactNode
}

export default function PaginaTermos({
  children,
}: PaginaTermosProps) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#F8F7FF] text-[#071A38] dark:bg-[#13131F] dark:text-white">
      {/* Decoração discreta */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-32 -z-10 h-80 w-80 rounded-full bg-[#8177FF]/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-[500px] -z-10 h-80 w-80 rounded-full bg-[#8177FF]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <TermosHero />

        <TermosResumo />

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <TermosNavegacao />

          <div className="min-w-0 space-y-5">
            {children}
          </div>
        </div>

        <TermosAviso />
      </div>
    </main>
  )
}