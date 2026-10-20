
import TermosSecao from './TermosSecao'
import { Lista } from '../Legal/PaginaLegal'

export default function TermosConta() {
  return (
    <TermosSecao
      id="conta"
      titulo="Sua conta e sua senha"
    >
      <Lista
        itens={[
          'Você entra com e-mail e senha ou com sua conta Google.',
          'Use dados verdadeiros e confirme seu e-mail.',
          'Guarde sua senha e não a compartilhe com ninguém.',
          'Você responde pelo que é feito na sua conta. Se achar que alguém usou sua conta, troque a senha e escreva para nós.',
        ]}
      />

      <p>
        Se você já tinha conta antes desta versão dos
        Termos, continuar usando o Elder Web vale como
        concordância. Se não concordar, você pode pedir
        a exclusão da conta pelo contato.
      </p>
    </TermosSecao>
  )
}
