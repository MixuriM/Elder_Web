
import TermosSecao from './TermosSecao'
import { Lista } from '../Legal/PaginaLegal'

export default function TermosRegras() {
  return (
    <TermosSecao
      id="regras"
      titulo="O que você pode e não pode fazer"
    >
      <p>
        Você pode usar o Elder Web para organizar a
        saúde e a rotina de uma pessoa idosa com
        quem tem vínculo.
      </p>

      <p>Você não pode:</p>

      <Lista
        itens={[
          'registrar informações falsas;',
          'usar a conta de outra pessoa ou deixar outra pessoa usar a sua;',
          'tentar ver ou mudar dados sem permissão, ou burlar as permissões do sistema;',
          'usar o Elder Web para qualquer coisa ilegal;',
          'enviar na foto de perfil conteúdo ilegal, ofensivo ou de outra pessoa sem autorização.',
        ]}
      />
    </TermosSecao>
  )
}
