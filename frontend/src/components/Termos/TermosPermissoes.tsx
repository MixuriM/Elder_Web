
import TermosSecao from './TermosSecao'
import { Lista } from '../Legal/PaginaLegal'

export default function TermosPermissoes() {
  return (
    <TermosSecao
      id="vinculos"
      titulo="Vínculos e permissões"
    >
      <Lista
        itens={[
          'Cuidador e familiar só veem os dados de uma pessoa idosa depois de um vínculo aprovado.',
          'Um vínculo começa com um pedido do cuidador ou do familiar, com um convite da pessoa idosa, ou com o cadastro da pessoa idosa feito por um familiar.',
          'Quem aprova ou recusa é quem decide pela pessoa idosa: ela mesma ou, se ela passou essa decisão, um familiar com vínculo aprovado.',
          'Alguns vínculos de familiar são aprovados pela confirmação do e-mail. Mesmo assim, quem decide pode contestar.',
          'O cuidador começa sem permissões. Ele só registra saúde, marca dose de remédio ou cria compromisso de cuidado se quem decide ligar cada permissão.',
        ]}
      />
    </TermosSecao>
  )
}
