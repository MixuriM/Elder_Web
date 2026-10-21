
import '@testing-library/jest-dom'

import {
  render,
  screen,
  within,
} from '@testing-library/react'

import { MemoryRouter } from 'react-router-dom'

import Cookies from './Cookies'

import {
  DATA_ATUALIZACAO,
  EMAIL_SUPORTE,
  URL_PRIVACIDADE_FIREBASE,
  URL_PRIVACIDADE_GOOGLE,
  VERSAO_DOCUMENTOS,
} from '../lib/documentosLegais'

// ==========================================
// CONFIGURAÇÃO DOS TESTES
// ==========================================

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/cookies']}>
      <Cookies />
    </MemoryRouter>,
  )
}

// ==========================================
// SEÇÕES ESPERADAS
// ==========================================

const SECOES_ESPERADAS = [
  'O que são cookies e armazenamento no navegador',
  'O que o Elder Web guarda no seu navegador',
  'Serviços de terceiros',
  'Como apagar',
  'Mudanças nesta política',
  'Contato',
]

// ==========================================
// CHAVES DOCUMENTADAS
// ==========================================

// Ao adicionar uma nova chave de armazenamento,
// atualizar também Cookies.tsx e
// lib/armazenamentoDocumentado.test.ts.

const CHAVES = [
  'tema',
  'tamanhoTexto',
  'reduzirMovimento',
  'agendaVisao',
  'agendaModo',
  'elderweb:fotoPerfil',
  'elder-preload-recarregado',
  'firebaseLocalStorageDb',
  'firebase-heartbeat-database',
]

// ==========================================
// TESTES DA POLÍTICA DE COOKIES
// ==========================================

describe('Política de Cookies', () => {
  // ========================================
  // ESTRUTURA DA PÁGINA
  // ========================================

  it('possui um único conteúdo principal', () => {
    renderPagina()

    expect(
      screen.getAllByRole('main'),
    ).toHaveLength(1)
  })

  it('possui um único documento principal', () => {
    renderPagina()

    expect(
      screen.getAllByRole('article'),
    ).toHaveLength(1)
  })

  it('exibe o título da Política de Cookies', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Política de Cookies e armazenamento no navegador',
      }),
    ).toBeInTheDocument()
  })

  it('associa corretamente o título ao documento', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    const titulo = within(artigo).getByRole('heading', {
      name: 'Política de Cookies e armazenamento no navegador',
    })

    expect(artigo).toHaveAttribute(
      'aria-labelledby',
      titulo.id,
    )
  })

  it('permite quebrar o título em telas pequenas', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    const titulo = within(artigo).getByRole('heading', {
      name: 'Política de Cookies e armazenamento no navegador',
    })

    expect(titulo).toHaveClass('break-words')
  })

  // ========================================
  // SEÇÕES DO DOCUMENTO
  // ========================================

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
        secoes[i - 1].compareDocumentPosition(
          secoes[i],
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  // ========================================
  // RESUMO
  // ========================================

  it('exibe o resumo da política', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Resumo em poucas linhas',
      }),
    ).toBeInTheDocument()
  })

  // ========================================
  // NAVEGAÇÃO SUPERIOR
  // ========================================

  it('exibe a navegação entre documentos legais', () => {
    renderPagina()

    expect(
      screen.getByRole('navigation', {
        name: 'Documentos legais',
      }),
    ).toBeInTheDocument()
  })

  it('marca Cookies como documento atual', () => {
    renderPagina()

    const nav = screen.getByRole('navigation', {
      name: 'Documentos legais',
    })

    expect(
      within(nav).getByRole('link', {
        name: /Política de Cookies/,
      }),
    ).toHaveAttribute('aria-current', 'page')

    expect(
      within(nav).getByRole('link', {
        name: 'Termos de Uso',
      }),
    ).toHaveAttribute('href', '/termos')

    expect(
      within(nav).getByRole('link', {
        name: 'Política de Privacidade',
      }),
    ).toHaveAttribute('href', '/privacidade')
  })

  // ========================================
  // MENU LATERAL REMOVIDO
  // ========================================

  it('não exibe o menu lateral de seções', () => {
    renderPagina()

    expect(
      screen.queryByRole('navigation', {
        name: 'Seções deste documento',
      }),
    ).not.toBeInTheDocument()
  })

  // ========================================
  // VERSÃO E CONTATO
  // ========================================

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

  // ========================================
  // ARMAZENAMENTO DO NAVEGADOR
  // ========================================

  it('documenta todas as chaves guardadas no navegador', () => {
    renderPagina()

    const tabela = screen.getByRole('table', {
      name: /guardado no seu navegador/i,
    })

    for (const chave of CHAVES) {
      expect(
        within(tabela).getByText(chave, {
          selector: 'code',
        }),
      ).toBeInTheDocument()
    }
  })

  it('possui as colunas corretas na tabela', () => {
    renderPagina()

    const tabela = screen.getByRole('table', {
      name: /guardado no seu navegador/i,
    })

    const colunas = [
      'Nome',
      'Onde fica',
      'Para que serve',
      'Quando sai',
      'Quem define',
    ]

    for (const coluna of colunas) {
      expect(
        within(tabela).getByRole('columnheader', {
          name: coluna,
        }),
      ).toBeInTheDocument()
    }
  })

  // ========================================
  // COOKIES E CONSENTIMENTO
  // ========================================

  it('informa que não cria cookies próprios', () => {
    const { container } = renderPagina()

    expect(container.textContent).toMatch(
      /não cria cookies próprios/i,
    )
  })

  it('não apresenta banner de consentimento', () => {
    renderPagina()

    expect(
      screen.queryByRole('button', {
        name: /aceitar|recusar/i,
      }),
    ).not.toBeInTheDocument()
  })

  // ========================================
  // LINKS EXTERNOS
  // ========================================

  it('possui apenas os dois links externos permitidos', () => {
    renderPagina()

    const externos = screen
      .getAllByRole('link')
      .filter((link) =>
        link.getAttribute('href')?.startsWith('http'),
      )

    expect(
      externos
        .map((link) => link.getAttribute('href'))
        .sort(),
    ).toEqual(
      [
        URL_PRIVACIDADE_FIREBASE,
        URL_PRIVACIDADE_GOOGLE,
      ].sort(),
    )
  })

  it('abre os links externos com proteção', () => {
    renderPagina()

    const externos = screen
      .getAllByRole('link')
      .filter((link) =>
        link.getAttribute('href')?.startsWith('http'),
      )

    for (const link of externos) {
      expect(link).toHaveAttribute(
        'rel',
        'noopener noreferrer',
      )
    }
  })

  // ========================================
  // CONTEÚDO FORA DO ESCOPO
  // ========================================

  it('não menciona funcionalidades fora do projeto', () => {
    const { container } = renderPagina()

    expect(container.textContent).not.toMatch(
      /alexa|mensagens|loja|microfone|lar são vicente/i,
    )
  })
})
