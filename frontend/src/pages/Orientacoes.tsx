
import { useTitulo } from '../hooks/useTitulo'

import CabecalhoOrientacoes from '../components/orientacoes/CabecalhoOrientacoes'
import ListaOrientacoes from '../components/orientacoes/ListaOrientacoes'
import AjudaOrientacoes from '../components/orientacoes/AjudaOrientacoes'

// RF-031 — Item 8.2
// Conteúdo e layout: Laureane e Jennifer.

export default function Orientacoes() {
  useTitulo('Orientações')

  return (
    <main className="flex-1 bg-white text-lg text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA]">
      <div className="mx-auto max-w-3xl space-y-8 p-4">
        <CabecalhoOrientacoes />

        <ListaOrientacoes />

        <AjudaOrientacoes />
      </div>
    </main>
  )
}
