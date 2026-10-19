
import { useTitulo } from '../hooks/useTitulo'

import CabecalhoOrientacoes from '../components/orientacoes/CabecalhoOrientacoes'
import ListaOrientacoes from '../components/orientacoes/ListaOrientacoes'
import AjudaOrientacoes from '../components/orientacoes/AjudaOrientacoes'

import {
  paginaOrientacoes,
  containerOrientacoes,
} from '../components/orientacoes/estilosOrientacoes'

// RF-031 — Item 8.2
// Conteúdo e layout: Laureane e Jennifer.

export default function Orientacoes() {
  useTitulo('Orientações')

  return (
    <div className={paginaOrientacoes}>
      <div className={containerOrientacoes}>
        <CabecalhoOrientacoes />

        <ListaOrientacoes />

        <AjudaOrientacoes />
      </div>
    </div>
  )
}
