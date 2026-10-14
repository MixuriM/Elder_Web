// Política de Cookies e armazenamento no navegador. Sem banner: o Elder Web não cria cookies nem usa rastreador
// (conferido em 14/10/2026). Chave nova de storage: entra na tabela e em lib/armazenamentoDocumentado.test.ts.
import type { ReactNode } from 'react'

import PaginaLegal, { LinkContato, LinkExterno, LinkInterno, Lista, Secao, Tabela } from '../components/Legal/PaginaLegal'
import { URL_PRIVACIDADE_FIREBASE, URL_PRIVACIDADE_GOOGLE } from '../lib/documentosLegais'

const RESUMO = [
  'O Elder Web não cria cookies próprios e não usa cookies de publicidade nem de estatística.',
  'O site guarda no seu navegador só o necessário: suas preferências de tela, a sessão de login e uma cópia da sua foto.',
  'Por isso não mostramos aviso para aceitar cookies: não há nada opcional para aceitar.',
  'Você pode apagar tudo isso nas configurações do navegador.',
]

const LOCAL = 'Armazenamento local (localStorage)'
const ATE_APAGAR = 'Fica até você apagar os dados do site no navegador.'
const ELDER = 'Elder Web'

const c = (nome: string) => <code className="font-mono font-semibold">{nome}</code>

const ITENS: ReactNode[][] = [
  [c('tema'), LOCAL, 'Lembrar o tema escolhido: claro, escuro ou igual ao do aparelho.', ATE_APAGAR, ELDER],
  [c('tamanhoTexto'), LOCAL, 'Lembrar o tamanho do texto escolhido.', ATE_APAGAR, ELDER],
  [c('reduzirMovimento'), LOCAL, 'Lembrar se você quer menos animações.', ATE_APAGAR, ELDER],
  [c('agendaVisao'), LOCAL, 'Lembrar se a Agenda aparece como calendário ou como lista.', ATE_APAGAR, ELDER],
  [c('agendaModo'), LOCAL, 'Lembrar se o calendário da Agenda mostra o mês ou o dia.', ATE_APAGAR, ELDER],
  [
    c('elderweb:fotoPerfil'),
    LOCAL,
    'Uma cópia da sua foto de perfil, para ela aparecer mais rápido, junto com o código da sua conta de login (assim outra conta nunca vê a sua foto).',
    'Sai quando você sai da conta, ou quando apaga os dados do site.',
    ELDER,
  ],
  [
    c('elder-preload-recarregado'),
    'Armazenamento da aba (sessionStorage)',
    'Marca que a página já foi recarregada uma vez depois de uma atualização do site, para não recarregar sem parar.',
    'Sai quando você fecha a aba.',
    ELDER,
  ],
  [
    c('firebaseLocalStorageDb'),
    'Banco do navegador (IndexedDB)',
    'Manter você conectado (sessão de login). Se o navegador não deixar usar esse banco, o Firebase usa o armazenamento local, com um nome que começa com firebase:authUser.',
    'A sessão sai quando você sai da conta, ou quando apaga os dados do site.',
    'Firebase Authentication (Google)',
  ],
  [
    c('firebase-heartbeat-database'),
    'Banco do navegador (IndexedDB)',
    'Guarda as datas em que o serviço de login foi usado e a versão dele. O Firebase envia essa informação ao Google junto com os pedidos de login, para as estatísticas do próprio Firebase. Não tem nome, e-mail nem dado de saúde.',
    ATE_APAGAR,
    'Firebase Authentication (Google)',
  ],
]

export default function Cookies() {
  return (
    <PaginaLegal titulo="Política de Cookies e armazenamento no navegador" resumo={RESUMO}>
      <Secao id="o-que-sao" titulo="O que são cookies e armazenamento no navegador">
        <p>
          Cookies são pequenos arquivos que um site guarda no seu navegador. Os sites também podem guardar informações de
          outros jeitos, como o armazenamento local e o banco do navegador. Tudo isso fica no seu aparelho.
        </p>
        <p>
          O Elder Web não cria cookies próprios. O servidor do Elder Web também não cria cookies. O site não tem
          publicidade, ferramentas de estatística de visitas nem rastreadores. As fontes e as imagens vêm do próprio site.
        </p>
      </Secao>

      <Secao id="o-que-guardamos" titulo="O que o Elder Web guarda no seu navegador">
        <Tabela
          legenda="O que fica guardado no seu navegador"
          colunas={['Nome', 'Onde fica', 'Para que serve', 'Quando sai', 'Quem define']}
          linhas={ITENS}
        />
        <p>
          As preferências (tema, tamanho do texto, animações e o jeito de ver a Agenda) são escolhas suas. Elas ficam só
          neste aparelho e não são enviadas a ninguém. Em outro aparelho ou navegador, você escolhe de novo.
        </p>
      </Secao>

      <Secao id="terceiros" titulo="Serviços de terceiros">
        <Lista
          itens={[
            'Entrar com Google: abre uma janela do Google. Nessa janela, o Google pode usar os próprios cookies, conforme a política dele.',
            'Serviço de login: o Firebase Authentication pode abrir um quadro invisível do próprio serviço de login e carregar ali um código do Google, necessário para o login funcionar. Em celulares e no Safari, isso acontece logo que o site abre. Esse quadro pode guardar dados próprios, conforme a política do Google.',
          ]}
        />
        <p>
          Saiba mais na <LinkExterno href={URL_PRIVACIDADE_GOOGLE}>Política de Privacidade do Google</LinkExterno> e na
          página de <LinkExterno href={URL_PRIVACIDADE_FIREBASE}>privacidade do Firebase</LinkExterno>.
        </p>
      </Secao>

      <Secao id="como-apagar" titulo="Como apagar">
        <Lista
          itens={[
            'No computador (Chrome ou Edge): clique no ícone ao lado do endereço do site, depois em "Cookies e dados do site" ou "Configurações do site", e apague os dados.',
            'No celular: abra as configurações do navegador, procure "Configurações do site" ou "Privacidade" e apague os dados do Elder Web.',
            'Ou use uma janela anônima: o navegador apaga tudo quando você fecha a janela.',
          ]}
        />
        <p>
          Ao apagar os dados do site, você sai da conta e as preferências voltam ao padrão. Sair da conta (em
          Configurações, botão "Sair da conta") já apaga a cópia da sua foto.
        </p>
      </Secao>

      <Secao id="mudancas" titulo="Mudanças nesta política">
        <p>
          Se o Elder Web passar a guardar algo novo no navegador, esta página muda antes. A versão e a data da última
          atualização ficam no topo da página. Veja também a{' '}
          <LinkInterno to="/privacidade">Política de Privacidade</LinkInterno>.
        </p>
      </Secao>

      <Secao id="contato" titulo="Contato">
        <p>
          Dúvidas: <LinkContato />.
        </p>
      </Secao>
    </PaginaLegal>
  )
}
