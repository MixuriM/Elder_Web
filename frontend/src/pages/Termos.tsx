// Termos de Uso (sem RF numerado; RNF-001, LGPD). Não prometer lembrete, alarme, monitoramento nem disponibilidade.
// Texto sem revisão jurídica. Mudou regra do serviço: atualize e suba VERSAO_DOCUMENTOS.
import PaginaLegal, { LinkContato, LinkInterno, Lista, Secao } from '../components/Legal/PaginaLegal'

const RESUMO = [
  'O Elder Web ajuda a organizar a saúde e a rotina de uma pessoa idosa, junto com cuidadores e familiares.',
  'Ele não faz diagnóstico, não indica tratamento e não substitui médico. Em emergência, ligue 192 (SAMU).',
  'É um projeto acadêmico e gratuito: pode ficar fora do ar, mudar ou ser encerrado.',
  'Ao criar a conta, você declara que leu e concorda com estes Termos e com a Política de Privacidade.',
]

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso" resumo={RESUMO} avisoAcademico>
      <Secao id="sobre" titulo="Sobre o Elder Web">
        <p>
          O Elder Web é um site para apoiar pessoas idosas, cuidadores e familiares no dia a dia: saúde, remédios, agenda
          e alimentação. Ele foi feito por Marcos, Laureane e Jennifer como Trabalho de Conclusão de Curso do Curso
          Técnico em Desenvolvimento de Sistemas da Etec Fernando Prestes. É gratuito e não tem fins lucrativos.
        </p>
        <p>
          Estes Termos explicam as regras de uso. A <LinkInterno to="/privacidade">Política de Privacidade</LinkInterno>{' '}
          explica o que fazemos com seus dados.
        </p>
      </Secao>

      <Secao id="quem-pode-usar" titulo="Quem pode usar">
        <p>
          O Elder Web é para pessoas com 18 anos ou mais. Há três perfis: idoso, cuidador e familiar. Você escolhe o
          perfil no cadastro, e ele não muda depois.
        </p>
      </Secao>

      <Secao id="conta" titulo="Sua conta e sua senha">
        <Lista
          itens={[
            'Você entra com e-mail e senha ou com sua conta Google.',
            'Use dados verdadeiros e confirme seu e-mail.',
            'Guarde sua senha e não a compartilhe com ninguém.',
            'Você responde pelo que é feito na sua conta. Se achar que alguém usou sua conta, troque a senha e escreva para nós.',
          ]}
        />
        <p>
          Se você já tinha conta antes desta versão dos Termos, continuar usando o Elder Web vale como concordância. Se
          não concordar, você pode pedir a exclusão da conta pelo contato.
        </p>
      </Secao>

      <Secao id="vinculos" titulo="Vínculos e permissões">
        <Lista
          itens={[
            'Cuidador e familiar só veem os dados de uma pessoa idosa depois de um vínculo aprovado.',
            'Um vínculo começa com um pedido do cuidador ou do familiar, com um convite da pessoa idosa, ou com o cadastro da pessoa idosa feito por um familiar.',
            'Quem aprova ou recusa é quem decide pela pessoa idosa: ela mesma ou, se ela passou essa decisão, um familiar com vínculo aprovado.',
            'Alguns vínculos de familiar são aprovados pela confirmação do e-mail. Mesmo assim, quem decide pode contestar.',
            'O cuidador começa sem permissões. Ele só registra saúde, marca dose de remédio ou cria compromisso de cuidado se quem decide ligar cada permissão.',
          ]}
        />
      </Secao>

      <Secao id="regras" titulo="O que você pode e não pode fazer">
        <p>Você pode usar o Elder Web para organizar a saúde e a rotina de uma pessoa idosa com quem tem vínculo.</p>
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
      </Secao>

      <Secao id="saude" titulo="Saúde: aviso importante">
        <p>
          O Elder Web organiza informações que as pessoas registram. Ele não faz diagnóstico, não aconselha tratamento e
          não substitui médico, enfermeiro ou farmacêutico. Antes de mudar um remédio ou um tratamento, fale com um
          profissional de saúde.
        </p>
        <p>
          <strong>Em emergência, ligue para o SAMU, telefone 192.</strong>
        </p>
      </Secao>

      <Secao id="emergencia" titulo="Aviso de emergência">
        <p>
          O botão de ajuda, que aparece para o perfil de idoso, envia um e-mail para as pessoas com vínculo aprovado que
          confirmaram o e-mail. Há um limite de envios por hora.
        </p>
        <p>
          O aviso depende da internet, do serviço de e-mail e de alguém ler a mensagem. O e-mail pode atrasar, cair na
          caixa de spam ou não chegar. Por isso, o aviso não substitui ligar 192: em perigo, ligue 192 primeiro.
        </p>
      </Secao>

      <Secao id="disponibilidade" titulo="Disponibilidade e mudanças no serviço">
        <p>
          O Elder Web roda em hospedagem gratuita. Ele pode demorar a responder no primeiro acesso, ficar fora do ar ou
          ter falhas. Não garantimos um tempo mínimo no ar.
        </p>
        <p>
          O projeto pode mudar ou ser encerrado. Quando possível, vamos avisar com pelo menos 30 dias de antecedência,
          para você baixar o histórico em PDF antes.
        </p>
      </Secao>

      <Secao id="responsabilidades" titulo="Responsabilidades">
        <p>
          Fazemos o possível para o Elder Web funcionar bem, mas ele é um projeto acadêmico em desenvolvimento.
          Respondemos pelo que fazemos na medida da lei. Nada nestes Termos tira direitos que o Código de Defesa do
          Consumidor ou outra lei garantem a você.
        </p>
        <p>Você responde pelo que registra e pelo uso da sua conta.</p>
      </Secao>

      <Secao id="propriedade" titulo="Propriedade intelectual">
        <p>
          O código, o nome Elder Web e a marca são dos autores do projeto. Os dados que você cadastra continuam sendo seus,
          ou da pessoa a quem se referem. Usamos esses dados só como explica a Política de Privacidade.
        </p>
      </Secao>

      <Secao id="encerramento" titulo="Encerramento e exclusão da conta">
        <p>
          Você pode parar de usar o Elder Web quando quiser. Para excluir a conta, use o botão Excluir minha conta em
          Meu Perfil: o que isso apaga e o que permanece está na Política de Privacidade. A conta de um idoso cadastrado
          por um familiar que ainda não entrou no site só se exclui pelo contato. Se quiser, baixe antes o histórico em
          PDF.
        </p>
        <p>
          Podemos suspender ou encerrar uma conta que não cumpra estes Termos, por exemplo uma conta usada por outra
          pessoa ou usada para burlar as permissões.
        </p>
      </Secao>

      <Secao id="mudancas" titulo="Mudanças nestes Termos">
        <p>
          Podemos mudar estes Termos. A versão e a data da última atualização ficam no topo da página. Continuar usando o
          Elder Web depois de uma mudança vale como concordância. Se não concordar, você pode pedir a exclusão da conta.
        </p>
      </Secao>

      <Secao id="lei-e-foro" titulo="Lei e foro">
        <p>
          Estes Termos seguem as leis do Brasil. Se houver um processo judicial, ele corre na comarca de Sorocaba (SP).
          Mas, se a lei garantir a você, como consumidor, o direito de processar na cidade onde mora, esse direito vale.
        </p>
      </Secao>

      <Secao id="contato" titulo="Contato">
        <p>
          Dúvidas sobre estes Termos: <LinkContato />. Não envie valores nem informações de saúde por e-mail.
        </p>
      </Secao>
    </PaginaLegal>
  )
}
