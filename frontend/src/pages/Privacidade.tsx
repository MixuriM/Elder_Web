// Política de Privacidade (sem RF numerado; RNF-001, LGPD). Cada frase tem base no código, no schema ou no CLAUDE.md.
// Texto sem revisão jurídica. Mudou dado coletado ou provedor: atualize e suba VERSAO_DOCUMENTOS.
import PaginaLegal, { LinkContato, LinkInterno, Lista, Secao, Tabela } from '../components/Legal/PaginaLegal'

const RESUMO = [
  'Guardamos só o que você, ou quem tem vínculo com uma pessoa idosa, registra no Elder Web para organizar a saúde e a rotina dela.',
  'Dados de saúde são sensíveis: só quem tem vínculo aprovado vê, e cada um só faz o que as permissões deixam.',
  'Não vendemos seus dados, não mostramos publicidade e não usamos ferramentas de rastreamento.',
  'Você corrige seus dados e baixa o histórico em PDF no próprio site. Para apagar a conta, escreva para nós.',
]

const DADOS = [
  ['Nome', 'No cadastro. Você pode mudar em Meu Perfil.', 'Mostrar quem é você para as pessoas com quem você tem vínculo.'],
  [
    'E-mail',
    'No cadastro. Você pode mudar em Meu Perfil.',
    'Entrar na conta, confirmar que o e-mail é seu, ligar contas e receber o aviso de emergência.',
  ],
  ['Telefone (opcional)', 'Quando você informa em Meu Perfil, ou quando um familiar cadastra a pessoa idosa.', 'Ficar no perfil como forma de contato.'],
  ['Tipo de perfil (idoso, cuidador ou familiar)', 'No cadastro. Não muda depois.', 'Mostrar as telas e as ações certas para cada perfil.'],
  [
    'Foto de perfil (opcional)',
    'Quando você envia em Meu Perfil. Você pode trocar ou remover.',
    'Mostrar sua foto no site. Guardamos uma cópia reduzida, no formato WebP.',
  ],
  ['Datas da conta', 'Automaticamente: quando a conta foi criada e o último acesso.', 'Funcionamento e segurança da conta.'],
  [
    'Registro do aceite (data e versão)',
    'Quando você marca as caixas do cadastro (ou da confirmação de e-mail da conta criada por um familiar).',
    'Provar que você aceitou os Termos e a Política e deu o consentimento para os dados de saúde.',
  ],
  [
    'Vínculos e permissões',
    'Quando alguém pede, convida, aprova, recusa ou contesta um vínculo, ou muda uma permissão.',
    'Definir quem pode ver e registrar dados de cada pessoa idosa. Guardamos também quem aprovou e quando.',
  ],
  [
    'Quem decide pela pessoa idosa',
    'Quando a pessoa idosa escolhe, ou quando a decisão passa para um familiar (com o motivo, se informado).',
    'Saber quem aprova vínculos e permissões.',
  ],
  [
    'E-mail de um familiar (opcional)',
    'Quando a pessoa idosa informa no cadastro dela.',
    'Ligar a conta da pessoa idosa à conta desse familiar. É um dado de outra pessoa: só informe com a concordância dela.',
  ],
  [
    'Data do termo de responsabilidade',
    'Quando um familiar cadastra uma pessoa idosa.',
    'Guardar quando o familiar aceitou o termo de responsabilidade desse cadastro.',
  ],
  [
    'Registros de saúde',
    'Quando a pessoa idosa, ou quem tem permissão, registra uma medição.',
    'Mostrar o histórico de saúde: tipo de medição, valores, unidade, data, hora e observações.',
  ],
  [
    'Remédios e doses',
    'Quando um remédio é cadastrado ou uma dose é marcada.',
    'Mostrar o que a pessoa idosa toma e o histórico de doses: nome, dosagem, frequência, datas e observações.',
  ],
  [
    'Compromissos da agenda',
    'Quando alguém com permissão cria ou edita um compromisso.',
    'Organizar a rotina: tipo, título, descrição, data e hora. O título de uma consulta médica pode dizer algo sobre a saúde.',
  ],
  [
    'Registros de alimentação',
    'Quando a pessoa idosa, ou quem tem permissão, registra uma refeição.',
    'Acompanhar a alimentação: tipo de refeição, descrição, data e hora.',
  ],
  ['Quem registrou e quem editou', 'Automaticamente, em cada registro.', 'Mostrar de quem é cada informação.'],
]

const COMPARTILHAMENTO = [
  [
    'Pessoas com vínculo aprovado (cuidador ou familiar)',
    'Dados básicos do seu perfil, como o nome, e os dados da pessoa idosa que o vínculo e as permissões liberam.',
    'Cuidar junto da pessoa idosa.',
  ],
  [
    'Firebase Authentication (Google)',
    'E-mail e senha. Se você entra com Google, o nome e o e-mail da conta Google.',
    'Fazer o login, confirmar o e-mail e trocar a senha esquecida.',
  ],
  ['Microsoft Azure', 'Os dados guardados no banco de dados.', 'Guardar os dados (banco de dados).'],
  ['Render', 'Os dados que passam pelo servidor a cada uso do site.', 'Rodar o servidor do Elder Web.'],
  ['Vercel', 'Dados técnicos de acesso às páginas, como o endereço IP.', 'Hospedar as telas do site.'],
  [
    'Brevo',
    'O nome da pessoa idosa, a data e a hora do pedido de ajuda e o e-mail de quem vai receber o aviso.',
    'Entregar o e-mail do aviso de emergência.',
  ],
]

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" resumo={RESUMO} avisoAcademico>
      <Secao id="responsavel" titulo="Quem é responsável pelos seus dados">
        <p>
          O Elder Web foi feito por Marcos, Laureane e Jennifer, estudantes do Curso Técnico em Desenvolvimento de
          Sistemas da Etec Fernando Prestes, como Trabalho de Conclusão de Curso. Nós somos os responsáveis pelos seus
          dados (a lei chama isso de controlador). O projeto não tem fins lucrativos e não é uma empresa.
        </p>
        <p>
          Para qualquer assunto sobre seus dados, inclusive para exercer seus direitos, escreva para <LinkContato />.
        </p>
      </Secao>

      <Secao id="dados" titulo="Quais dados coletamos">
        <Tabela legenda="Dados que coletamos" colunas={['Dado', 'Quando coletamos', 'Para que serve']} linhas={DADOS} />
        <p>
          Sua senha não fica no nosso banco de dados: quem guarda e confere a senha é o Firebase Authentication, do
          Google. Se você entra com Google, recebemos o nome e o e-mail da sua conta Google, mas não usamos a foto dela.
        </p>
        <p>
          Para corrigir falhas, o servidor anota informações técnicas dos erros, como o tipo do erro e o endereço da
          página do sistema. Essas anotações não têm dados de saúde. Os provedores de hospedagem também podem anotar
          dados técnicos de acesso, como o endereço IP, conforme as regras deles.
        </p>
      </Secao>

      <Secao id="saude" titulo="Dados de saúde">
        <p>
          Registros de saúde, remédios e doses, refeições e compromissos médicos são dados sensíveis. A lei protege esses
          dados de forma especial, e nós também.
        </p>
        <Lista
          itens={[
            'Só veem esses dados a própria pessoa idosa e quem tem vínculo aprovado com ela.',
            'O cuidador começa sem permissões. Ele só registra saúde, marca dose de remédio ou cria compromisso de cuidado se quem decide pela pessoa idosa ligar essa permissão.',
            'Os dados de saúde não aparecem nos registros de erro do sistema.',
            'O Elder Web não monitora a pessoa idosa: ele só mostra o que foi registrado.',
          ]}
        />
        <p>
          Ao criar a conta, você marca uma caixa consentindo com o uso dos dados de saúde que cadastrar. Você pode
          retirar esse consentimento quando quiser, pedindo a exclusão pelo contato. Sem esses dados, as funções de saúde
          não funcionam.
        </p>
      </Secao>

      <Secao id="finalidades" titulo="Para que usamos e para que não usamos">
        <p>Usamos seus dados para:</p>
        <Lista
          itens={[
            'criar e manter sua conta e fazer o login;',
            'mostrar os dados só para as pessoas certas, conforme os vínculos e as permissões;',
            'mostrar quem registrou ou editou cada informação;',
            'montar o histórico em PDF quando alguém com acesso pede;',
            'enviar o aviso de emergência quando a pessoa idosa aperta o botão de ajuda;',
            'enviar e-mails de confirmação de cadastro e de troca de senha;',
            'proteger o sistema contra acesso indevido.',
          ]}
        />
        <p>Não usamos seus dados para:</p>
        <Lista
          itens={[
            'publicidade de qualquer tipo;',
            'venda ou aluguel de dados: não vendemos seus dados;',
            'rastrear você em outros sites;',
            'montar perfil de comportamento ou de consumo;',
            'estatísticas de visitas (o site não tem ferramentas de analytics);',
            'tomar decisões automáticas sobre você.',
          ]}
        />
      </Secao>

      <Secao id="base-legal" titulo="Base legal">
        <p>A LGPD (Lei 13.709/2018) só permite usar dados pessoais com uma base legal. As nossas são:</p>
        <Lista
          itens={[
            'conta, login e vínculos: necessários para prestar o serviço que você pediu ao criar a conta (execução de contrato, Art. 7º, V);',
            'dados de saúde que você cadastra: seu consentimento específico e destacado, dado na caixa do cadastro (Art. 11, I);',
            'aviso de emergência: o pedido da pessoa idosa ao apertar o botão e a proteção da vida dela (Art. 7º, VII e Art. 11, II, "e");',
            'segurança e prevenção de fraude, sem dados de saúde: nosso legítimo interesse em manter o sistema seguro (Art. 7º, IX).',
          ]}
        />
      </Secao>

      <Secao id="compartilhamento" titulo="Com quem compartilhamos">
        <Tabela
          legenda="Quem recebe dados"
          colunas={['Quem recebe', 'O que recebe', 'Por quê']}
          linhas={COMPARTILHAMENTO}
        />
        <p>
          <strong>Aviso de emergência.</strong> Quando a pessoa idosa aperta o botão de ajuda, o Elder Web envia um
          e-mail para cada pessoa com vínculo aprovado que confirmou o e-mail. O e-mail diz o nome da pessoa idosa, a
          data e a hora do pedido (horário de Brasília) e pede para ligar para ela ou para o 192. Nenhum dado de saúde
          vai no e-mail.
        </p>
        <p>
          Também podemos ter que entregar dados se uma lei ou uma ordem judicial exigir. Fora desses casos, não
          compartilhamos seus dados.
        </p>
      </Secao>

      <Secao id="fora-do-brasil" titulo="Dados fora do Brasil">
        <p>
          Alguns desses provedores podem guardar ou tratar dados em servidores fora do Brasil. Quando isso acontece, a
          transferência segue as regras da LGPD para transferência internacional de dados (Art. 33).
        </p>
      </Secao>

      <Secao id="retencao" titulo="Por quanto tempo guardamos">
        <p>
          Seus dados ficam guardados enquanto a conta existir. Você pode excluir a conta em Meu Perfil, no botão
          Excluir minha conta. Se a conta for de idoso, isso apaga o histórico de saúde, remédios, agenda e
          alimentação e remove o acesso de familiares e cuidadores. Se for de cuidador ou familiar, remove os seus
          vínculos e os seus dados de perfil. Idosos que você cadastrou, que ainda não acessaram a própria conta e que não tenham outro
          vínculo aprovado também são apagados. Não dá para desfazer.
        </p>
        <p>
          O que permanece: o que você registrou sobre outros idosos continua no histórico deles, sem o seu nome (a conta
          passa a se chamar Conta excluída), e guardamos o registro de que os documentos foram aceitos (data e versão),
          sem nome nem contato. Cópias de segurança automáticas do provedor do banco de dados podem manter os dados por um
          tempo limitado, definido pelo provedor, até serem substituídas.
        </p>
      </Secao>

      <Secao id="direitos" titulo="Seus direitos e como exercer">
        <p>Pela LGPD (Art. 18), você pode pedir:</p>
        <Lista
          itens={[
            'confirmação de que tratamos seus dados, e acesso a eles;',
            'correção de dados incompletos, errados ou desatualizados;',
            'anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados fora da lei;',
            'portabilidade dos dados para outro serviço;',
            'eliminação dos dados tratados com o seu consentimento;',
            'informação sobre com quem compartilhamos seus dados;',
            'informação sobre o que acontece se você não der o consentimento;',
            'retirada do consentimento.',
          ]}
        />
        <p>
          O que você já faz no próprio site: mudar nome, e-mail, telefone e foto em Meu Perfil (e remover a foto), e
          baixar o histórico de remédios e saúde em PDF.
        </p>
        <p>
          Para excluir a conta, use o botão Excluir minha conta em Meu Perfil. A conta de um idoso cadastrado por um
          familiar que ainda não entrou no site só se exclui pelo contato, assim como os outros pedidos: escreva para{' '}
          <LinkContato />. Respondemos em até 15 dias (Art. 19, II). Podemos pedir uma confirmação para ter certeza de que o pedido é seu.
          Não envie valores nem informações de saúde por e-mail. Você também pode reclamar à Autoridade Nacional de
          Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao id="conta-familiar" titulo="Conta criada por um familiar">
        <p>
          Um familiar pode cadastrar uma pessoa idosa no Elder Web. Ao fazer isso, o familiar aceita um termo de
          responsabilidade: declara que conversou com a pessoa idosa, ou com quem a representa, e que vai usar os dados
          só para cuidar dela.
        </p>
        <p>
          O sistema não tem como conferir se a pessoa idosa concordou de fato. Por isso, se o familiar informou o e-mail
          dela, a pessoa idosa pode assumir a conta: basta criar o acesso com esse mesmo e-mail e confirmá-lo. Ela também
          pode pedir a exclusão da conta e dos dados pelo contato.
        </p>
      </Secao>

      <Secao id="menores" titulo="Menores de idade">
        <p>
          O Elder Web é para pessoas com 18 anos ou mais. Não é permitido criar conta para menores de idade. O sistema não
          verifica a idade; se soubermos de uma conta de menor, podemos apagá-la.
        </p>
      </Secao>

      <Secao id="seguranca" titulo="Segurança">
        <Lista
          itens={[
            'A comunicação com o servidor usa conexão protegida (HTTPS), e o servidor pede ao navegador para usar sempre a conexão protegida (HSTS).',
            'A conexão entre o servidor e o banco de dados também é criptografada (TLS).',
            'O banco de dados guarda os dados criptografados.',
            'O login é feito pelo Firebase Authentication, e o servidor confere a identidade a cada pedido.',
            'O acesso aos dados de outra pessoa só acontece com vínculo aprovado, conferido no servidor e não só na tela.',
            'Os dados de saúde ficam fora dos registros de erro.',
            'Cada foto enviada é conferida e convertida de novo, o que descarta informações escondidas no arquivo, como a localização.',
          ]}
        />
        <p>
          Nenhum sistema é 100% seguro. Ajude também: não compartilhe sua senha e saia da conta quando usar o aparelho de
          outra pessoa.
        </p>
      </Secao>

      <Secao id="incidente" titulo="Se acontecer um incidente">
        <p>
          Se acontecer um incidente de segurança que possa trazer risco ou dano relevante a você, vamos avisar você e a
          ANPD, como manda a LGPD (Art. 48).
        </p>
      </Secao>

      <Secao id="mudancas" titulo="Mudanças nesta política">
        <p>
          Podemos mudar esta política quando o Elder Web mudar. A versão e a data da última atualização ficam no topo da
          página. Veja também os <LinkInterno to="/termos">Termos de Uso</LinkInterno> e a{' '}
          <LinkInterno to="/cookies">Política de Cookies</LinkInterno>.
        </p>
      </Secao>

      <Secao id="contato" titulo="Contato">
        <p>
          Dúvidas e pedidos sobre seus dados: <LinkContato />. Em emergência, não espere resposta por e-mail: ligue para o
          SAMU, telefone 192.
        </p>
      </Secao>
    </PaginaLegal>
  )
}
