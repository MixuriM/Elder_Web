import { Suspense, useRef, useState, type MouseEvent } from 'react'
import { Outlet } from 'react-router-dom'

import Header from '../Home/Header'
import Sidebar from '../Home/Sidebar'
import RotaProtegida from '../RotaProtegida'
import { AcessoProvider } from '../../contexts/AcessoContext'
import { AvisosProvider } from '../../contexts/AvisosContext'

// Moldura única das telas autenticadas: skip link, menu lateral, cabeçalho e UM <main>.
// As páginas renderizam só o conteúdo (div ou section), nunca outro <main>.
function LayoutAutenticado() {
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const conteudoRef = useRef<HTMLElement>(null)

  // Sem hash na URL: leva o foco direto ao conteúdo.
  function pularParaConteudo(evento: MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault()
    conteudoRef.current?.focus()
  }

  return (
    <RotaProtegida>
      <AcessoProvider>
      <AvisosProvider>
      <a
        href="#conteudo"
        onClick={pularParaConteudo}
        className="
          sr-only
          focus:not-sr-only
          focus:fixed
          focus:left-3
          focus:top-3
          focus:z-[60]
          focus:rounded-xl
          focus:bg-[#5F56EC]
          focus:px-5
          focus:py-3
          focus:text-base
          focus:font-semibold
          focus:text-white
        "
      >
        Pular para o conteúdo
      </a>

      <div className="flex min-h-screen bg-white dark:bg-[#0F0F17]">
        <Sidebar aberto={sidebarAberta} setAberto={setSidebarAberta} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header abrirSidebar={() => setSidebarAberta(true)} />

          <main
            id="conteudo"
            ref={conteudoRef}
            tabIndex={-1}
            className="flex flex-1 flex-col focus:outline-none"
          >
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
        </div>
      </div>
      </AvisosProvider>
      </AcessoProvider>
    </RotaProtegida>
  )
}

export default LayoutAutenticado
