
import PaginaTermos from '../components/Termos/PaginaTermos'

import TermosSobre from '../components/Termos/TermosSobre'
import TermosConta from '../components/Termos/TermosConta'
import TermosPermissoes from '../components/Termos/TermosPermissoes'
import TermosRegras from '../components/Termos/TermosRegras'
import TermosSaude from '../components/Termos/TermosSaude'
import TermosServico from '../components/Termos/TermosServico'
import TermosFinal from '../components/Termos/TermosFinal'

export default function Termos() {
  return (
    <PaginaTermos>
      <TermosSobre />
      <TermosConta />
      <TermosPermissoes />
      <TermosRegras />
      <TermosSaude />
      <TermosServico />
      <TermosFinal />
    </PaginaTermos>
  )
}
