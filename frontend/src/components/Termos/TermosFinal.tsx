
import TermosSecao from './TermosSecao'
import { LinkContato } from '../Legal/PaginaLegal'

export default function TermosFinal() {
  return (
    <>
      {/* ENCERRAMENTO E EXCLUSÃO DA CONTA */}
      <TermosSecao
        id="encerramento"
        titulo="Encerramento e exclusão da conta"
      >
        <p>
          Você pode parar de usar o Elder Web quando quiser.
          Para excluir a conta, use o botão Excluir minha conta
          em Meu Perfil: o que isso apaga e o que permanece
          está na Política de Privacidade. A conta de um idoso
          cadastrado por um familiar que ainda não entrou no
          site só se exclui pelo contato. Se quiser, baixe
          antes o histórico em PDF.
        </p>

        <p>
          Podemos suspender ou encerrar uma conta que não
          cumpra estes Termos, por exemplo uma conta usada
          por outra pessoa ou usada para burlar as permissões.
        </p>
      </TermosSecao>

      {/* MUDANÇAS NOS TERMOS */}
      <TermosSecao
        id="mudancas"
        titulo="Mudanças nestes Termos"
      >
        <p>
          Podemos mudar estes Termos. A versão e a data da
          última atualização ficam no topo da página.
          Continuar usando o Elder Web depois de uma mudança
          vale como concordância. Se não concordar, você
          pode pedir a exclusão da conta.
        </p>
      </TermosSecao>

      {/* LEI E FORO */}
      <TermosSecao
        id="lei-e-foro"
        titulo="Lei e foro"
      >
        <p>
          Estes Termos seguem as leis do Brasil. Se houver
          um processo judicial, ele corre na comarca de
          Sorocaba (SP). Mas, se a lei garantir a você,
          como consumidor, o direito de processar na cidade
          onde mora, esse direito vale.
        </p>
      </TermosSecao>

      {/* CONTATO */}
      <TermosSecao
        id="contato"
        titulo="Contato"
      >
        <p>
          Dúvidas sobre estes Termos: <LinkContato />.
          Não envie valores nem informações de saúde por e-mail.
        </p>
      </TermosSecao>
    </>
  )
}
