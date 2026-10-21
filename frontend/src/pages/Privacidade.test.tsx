
import '@testing-library/jest-dom'

import {
  render,
  screen,
  within,
} from '@testing-library/react'

import { MemoryRouter } from 'react-router-dom'

import Privacidade from './Privacidade'

import {
  DATA_ATUALIZACAO,
  EMAIL_SUPORTE,
  VERSAO_DOCUMENTOS,
} from '../lib/documentosLegais'

// ==========================================
// CONFIGURAÇÃO
// ==========================================

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/privacidade']}>
      <Privacidade />
    </MemoryRouter>,
  )
}

// ==========================================
// SEÇÕES ESPERADAS
// ==========================================

const SECOES_ESPERADAS = [
  'Quem é responsável pelos seus dados',
  'Quais dados coletamos',
  'Dados de saúde',
  'Para que usamos e para que não usamos',
  'Base legal',
  'Com quem compartilhamos',
  'Dados fora do Brasil',
  'Por quanto tempo guardamos',
  'Seus direitos e como exercer',
  'Conta criada por um familiar',
  'Menores de idade',
  'Segurança',
  'Se acontecer um incidente',
  'Mudanças nesta política',
  'Contato',
]

// ==========================================
// TESTES
// ==========================================

describe('Política de Privacidade', () => {
  // ESTRUTURA DA PÁGINA

  it('possui um único conteúdo principal', () => {
    renderPagina()

    expect(
      screen.getAllByRole('main'),
    ).toHaveLength(1)
  })

  it('exibe o título da Política de Privacidade', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Política de Privacidade',
      }),
    ).toBeInTheDocument()
  })

  // SEÇÕES DO DOCUMENTO

  it('mostra todas as seções como regiões acessíveis', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    for (const titulo of SECOES_ESPERADAS) {
      expect(
        within(artigo).getByRole('region', {
          name: titulo,
        }),
      ).toBeInTheDocument()
    }
  })

  it('mantém as seções na ordem correta', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    const secoes = SECOES_ESPERADAS.map((titulo) =>
      within(artigo).getByRole('region', {
        name: titulo,
      }),
    )

    for (let i = 1; i < secoes.length; i++) {
      expect(
        secoes[i - 1].compareDocumentPosition(secoes[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  // RESUMO

  it('exibe o resumo da política', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Resumo em poucas linhas',
      }),
    ).toBeInTheDocument()
  })

  // NAVEGAÇÃO ENTRE DOCUMENTOS

  it('marca Privacidade como página atual', () => {
    renderPagina()

    const nav = screen.getByRole('navigation', {
      name: 'Documentos legais',
    })

    expect(
      within(nav).getByRole('link', {
        name: 'Política de Privacidade',
      }),
    ).toHaveAttribute('aria-current', 'page')

    expect(
      within(nav).getByRole('link', {
        name: 'Termos de Uso',
      }),
    ).toHaveAttribute('href', '/termos')

    expect(
      within(nav).getByRole('link', {
        name: /Política de Cookies/,
      }),
    ).toHaveAttribute('href', '/cookies')

    expect(
      screen.getByRole('link', {
        name: 'Página inicial',
      }),
    ).toHaveAttribute('href', '/')
  })

  // MENU LATERAL

  it('exibe o menu lateral de seções', () => {
    renderPagina()

    const menu = screen.getByRole('navigation', {
      name: 'Seções deste documento',
    })

    expect(menu).toBeInTheDocument()

    expect(
      within(menu).getAllByRole('link', {
        name: /Dados coletados/i,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('possui links para as seções corretas', () => {
    renderPagina()

    const menu = screen.getByRole('navigation', {
      name: 'Seções deste documento',
    })

    const links = within(menu).getAllByRole('link')

    expect(
      links.some(
        (link) =>
          link.getAttribute('href') === '#dados',
      ),
    ).toBe(true)

    expect(
      links.some(
        (link) =>
          link.getAttribute('href') === '#direitos',
      ),
    ).toBe(true)

    expect(
      links.some(
        (link) =>
          link.getAttribute('href') === '#contato',
      ),
    ).toBe(true)
  })

  // VERSÃO E CONTATO

  it('mostra versão e data de atualização', () => {
    renderPagina()

    expect(
      screen.getByText(
        `Versão ${VERSAO_DOCUMENTOS}`,
        { exact: false },
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        DATA_ATUALIZACAO,
        { exact: false },
      ),
    ).toBeInTheDocument()
  })

  it('informa que é um projeto acadêmico', () => {
    renderPagina()

    expect(
      screen.getByText(
        'O Elder Web é um projeto acadêmico (TCC) e ainda não é um serviço comercial.',
      ),
    ).toBeInTheDocument()
  })

  it('possui contato por e-mail', () => {
    renderPagina()

    const contatos = screen.getAllByRole('link', {
      name: EMAIL_SUPORTE,
    })

    expect(contatos.length).toBeGreaterThan(0)

    for (const contato of contatos) {
      expect(contato).toHaveAttribute(
        'href',
        `mailto:${EMAIL_SUPORTE}`,
      )
    }
  })

  // PROTEÇÃO DE DADOS E SAÚDE

  it('informa que não vendemos dados', () => {
    const { container } = renderPagina()

    const texto = container.textContent ?? ''

    expect(texto).toMatch(/não vendemos/i)
    expect(texto).toMatch(/192/)

    expect(texto).not.toMatch(
      /lembrete|alarme|monitoramos/i,
    )
  })

  // REGISTRO DO ACEITE

  it('a tabela lista o registro do aceite', () => {
    renderPagina()

    const dados = screen.getByRole('table', {
      name: /dados que coletamos/i,
    })

    expect(
      within(dados).getByText(
        'Registro do aceite (data e versão)',
      ),
    ).toBeInTheDocument()

    expect(VERSAO_DOCUMENTOS).toBe('1.2')
  })

  // EXCLUSÃO DE CONTA

  it('explica a exclusão da conta e os dados mantidos', () => {
    const { container } = renderPagina()

    const texto = (
      container.textContent ?? ''
    ).replace(/\s+/g, ' ')

    expect(texto).not.toMatch(
      /não há botão para excluir a conta/i,
    )

    expect(texto).toMatch(/Excluir minha conta/)
    expect(texto).toMatch(/Meu Perfil/)
    expect(texto).toMatch(/Conta excluída/)

    expect(texto).not.toMatch(
      /aparece como Conta excluída/,
    )

    expect(texto).toMatch(
      /a conta passa a se chamar Conta excluída/,
    )

    expect(texto).toMatch(
      /Idosos que você cadastrou, que ainda não acessaram a própria conta e que não tenham outro vínculo aprovado também são apagados/,
    )

    expect(texto).not.toMatch(
      /guardamos só o registro/,
    )

    expect(texto).toMatch(/data e versão/)
    expect(texto).toMatch(/cópias de segurança/)

    expect(texto).not.toMatch(
      /cópias de segurança[^.]*\d+ dias/i,
    )
  })

  it('orienta sobre a exclusão de idoso sem login', () => {
    const { container } = renderPagina()

    const texto = (
      container.textContent ?? ''
    ).replace(/\s+/g, ' ')

    expect(texto).toMatch(
      /idoso cadastrado por um familiar que ainda não entrou no site[^.]*contato/i,
    )
  })

  // TABELAS

  it('possui a tabela de dados coletados', () => {
    renderPagina()

    expect(
      screen.getByRole('table', {
        name: /dados que coletamos/i,
      }),
    ).toBeInTheDocument()
  })

  it('possui a tabela de compartilhamento', () => {
    renderPagina()

    const tabela = screen.getByRole('table', {
      name: /quem recebe dados/i,
    })

    const provedores = [
      'Firebase Authentication',
      'Microsoft Azure',
      'Render',
      'Vercel',
      'Brevo',
    ]

    for (const provedor of provedores) {
      expect(
        within(tabela).getByText(provedor, {
          exact: false,
        }),
      ).toBeInTheDocument()
    }
  })

  // CONTEÚDOS FORA DO ESCOPO

  it('não menciona funcionalidades fora do projeto', () => {
    const { container } = renderPagina()

    expect(container.textContent).not.toMatch(
      /alexa|mensagens|loja|microfone|lar são vicente/i,
    )
  })
})
