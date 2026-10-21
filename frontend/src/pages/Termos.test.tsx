
import '@testing-library/jest-dom'

import {
  render,
  screen,
  within,
} from '@testing-library/react'

import { MemoryRouter } from 'react-router-dom'

import Termos from './Termos'

import {
  DATA_ATUALIZACAO,
  EMAIL_SUPORTE,
  VERSAO_DOCUMENTOS,
} from '../lib/documentosLegais'

// ==========================================
// CONFIGURAÇÃO DOS TESTES
// ==========================================

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/termos']}>
      <Termos />
    </MemoryRouter>
  )
}

// ==========================================
// SEÇÕES ESPERADAS
// ==========================================

const SECOES_ESPERADAS = [
  'Sobre o Elder Web',
  'Quem pode usar',
  'Sua conta e sua senha',
  'Vínculos e permissões',
  'O que você pode e não pode fazer',
  'Saúde: aviso importante',
  'Aviso de emergência',
  'Disponibilidade e mudanças no serviço',
  'Responsabilidades',
  'Propriedade intelectual',
  'Encerramento e exclusão da conta',
  'Mudanças nestes Termos',
  'Lei e foro',
  'Contato',
]

// ==========================================
// TESTES DOS TERMOS DE USO
// ==========================================

describe('Termos de Uso', () => {

  // ----------------------------------------
  // ESTRUTURA DA PÁGINA
  // ----------------------------------------

  it('possui um único conteúdo principal', () => {
    renderPagina()

    expect(
      screen.getAllByRole('main')
    ).toHaveLength(1)
  })

  it('exibe o título dos Termos de Uso', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Termos de Uso',
      })
    ).toBeInTheDocument()
  })

  // ----------------------------------------
  // SEÇÕES DO DOCUMENTO
  // ----------------------------------------

  it('mostra todas as seções dos Termos', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    for (const titulo of SECOES_ESPERADAS) {
      expect(
        within(artigo).getByRole('region', {
          name: titulo,
        })
      ).toBeInTheDocument()
    }
  })

  it('mantém as seções na ordem correta', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    const secoes = SECOES_ESPERADAS.map(
      (titulo) =>
        within(artigo).getByRole('region', {
          name: titulo,
        })
    )

    for (let i = 1; i < secoes.length; i++) {
      expect(
        secoes[i - 1].compareDocumentPosition(secoes[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
  })

  // ----------------------------------------
  // RESUMO
  // ----------------------------------------

  it('exibe o resumo dos Termos de Uso', () => {
    renderPagina()

    const artigo = screen.getByRole('article')

    expect(
      within(artigo).getByRole('heading', {
        name: 'Resumo em poucas linhas',
      })
    ).toBeInTheDocument()
  })

  // ----------------------------------------
  // NAVEGAÇÃO ENTRE DOCUMENTOS
  // ----------------------------------------

  it('marca Termos de Uso como página atual', () => {
    renderPagina()

    const nav = screen.getByRole('navigation', {
      name: 'Documentos legais',
    })

    expect(
      within(nav).getByRole('link', {
        name: 'Termos de Uso',
      })
    ).toHaveAttribute('aria-current', 'page')

    expect(
      within(nav).getByRole('link', {
        name: 'Política de Privacidade',
      })
    ).not.toHaveAttribute('aria-current')
  })

  // ----------------------------------------
  // MENU LATERAL
  // ----------------------------------------

  it('exibe o índice lateral de seções', () => {
    renderPagina()

    const menu = screen.getByRole('navigation', {
      name: 'Seções deste documento',
    })

    expect(menu).toBeInTheDocument()

    expect(
      within(menu).getAllByRole('link', {
        name: /Sobre o Elder Web/i,
      }).length
    ).toBeGreaterThan(0)
  })

  it('possui links para as seções corretas', () => {
    renderPagina()

    const menu = screen.getByRole('navigation', {
      name: 'Seções deste documento',
    })

    expect(
      within(menu).getAllByRole('link', {
        name: /Contato/i,
      })[0]
    ).toHaveAttribute('href', '#contato')

    expect(
      within(menu).getAllByRole('link', {
        name: /Saúde/i,
      })[0]
    ).toHaveAttribute('href', '#saude')
  })

  // ----------------------------------------
  // EXCLUSÃO DA CONTA
  // ----------------------------------------

  it('informa como excluir a conta', () => {
    const { container } = renderPagina()

    const texto = (
      container.textContent ?? ''
    ).replace(/\s+/g, ' ')

    expect(texto).toMatch(/Excluir minha conta/)
    expect(texto).toMatch(/Meu Perfil/)
    expect(texto).toMatch(/Política de Privacidade/)

    expect(texto).not.toMatch(
      /não há botão para excluir a conta/i
    )
  })

  // ----------------------------------------
  // VERSÃO E AVISO ACADÊMICO
  // ----------------------------------------

  it('mostra versão e data de atualização', () => {
    renderPagina()

    expect(
      screen.getByText(
        `Versão ${VERSAO_DOCUMENTOS}`,
        { exact: false }
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        DATA_ATUALIZACAO,
        { exact: false }
      )
    ).toBeInTheDocument()
  })

  it('informa que é um projeto acadêmico', () => {
    renderPagina()

    expect(
      screen.getByText(
        'O Elder Web é um projeto acadêmico (TCC) e ainda não é um serviço comercial.'
      )
    ).toBeInTheDocument()
  })

  // ----------------------------------------
  // CONTATO
  // ----------------------------------------

  it('possui contato por e-mail', () => {
    renderPagina()

    const links = screen.getAllByRole('link', {
      name: EMAIL_SUPORTE,
    })

    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `mailto:${EMAIL_SUPORTE}`
      )
    }
  })

  // ----------------------------------------
  // AVISOS DE SAÚDE
  // ----------------------------------------

  it('informa que não substitui atendimento médico', () => {
    const { container } = renderPagina()

    const texto = container.textContent ?? ''

    expect(texto).toMatch(/192/)
    expect(texto).toMatch(/não substitui/i)
    expect(texto).toMatch(/18 anos/)
    expect(texto).toMatch(/Sorocaba/)
  })

  // ----------------------------------------
  // FUNCIONALIDADES NÃO PROMETIDAS
  // ----------------------------------------

  it('não promete funcionalidades inexistentes', () => {
    const { container } = renderPagina()

    const texto = container.textContent ?? ''

    expect(texto).not.toMatch(
      /(registramos|guardamos|salvamos|armazenamos) (o |seu |a data do )?aceite/i
    )

    expect(texto).not.toMatch(
      /aceite[^.]*(fica|é|será) (registrado|guardado|salvo)/i
    )

    expect(texto).not.toMatch(
      /lembrete|alarme|monitoramos|garantimos que/i
    )

    expect(texto).not.toMatch(
      /alexa|mensagens|loja|microfone|lar são vicente/i
    )
  })
})
