import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuthUser } from '../../hooks/useAuthUser'
import Footer from '../landing/Footer'
import SobreHeader from '../SobreNos/SobreHeader'
import LayoutAutenticado from './LayoutAutenticado'

// Orientações é pública: logado mantém menu e cabeçalho (LayoutAutenticado); visitante ganha cabeçalho e rodapé
// públicos com UM <main>. A página em si não muda nem depende da sessão.
function MolduraOrientacoes() {
  const { usuario, carregando } = useAuthUser()

  if (carregando) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white p-8 dark:bg-[#0F0F17]">
        <p role="status" className="text-lg text-gray-900 dark:text-[#F5F5FA]">
          Carregando...
        </p>
      </main>
    )
  }

  if (usuario) return <LayoutAutenticado />

  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-[#0F0F17]">
      <SobreHeader />
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <Suspense
          fallback={
            <p role="status" className="p-8 text-lg text-gray-900 dark:text-[#F5F5FA]">
              Carregando...
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default MolduraOrientacoes
