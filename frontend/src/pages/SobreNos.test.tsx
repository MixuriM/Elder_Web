
import '@testing-library/jest-dom'

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import SobreNos from './SobreNos'
import { equipe, equipeColetiva } from '../components/SobreNos/sobreNosData'

expect.extend(toHaveNoViolations)

// ==========================================
// CONFIGURAÇÃO
// ==========================================

// SobreHeader e SobreCTA consultam a sessão.
// Nos testes, a página é acessada como visitante.
jest.mock('../lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(null)
    return () => {}
  },
}))

// O jsdom não calcula o contraste real das cores.
// O contraste deve ser validado separadamente.
const AXE = {
  rules: {
    'color-contrast': { enabled: false },
  },
}

function renderSobreNos() {
  return render(
    <MemoryRouter initialEntries={['/sobre-nos']}>
      <SobreNos />
    </MemoryRouter>,
  )
}

const SECOES_ESPERADAS = [
  'O que é o Elder Web',
  'Para quem é',
  'O que reúne',
  'Nosso compromisso com a acessibilidade',
  'Quem fez',
]

// ==========================================
// TESTES
// ==========================================

describe('SobreNos (item 8.1, RF-029)', () => {
  // ESTRUTURA DA PÁGINA

  it('renderiza a página Sobre nós', () => {
    renderSobreNos()

    expect(screen.getByRole('main')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sobre o elder web/i,
      }),
    ).toBeInTheDocument()
  })

  it('possui apenas um h1 e um main', () => {
    renderSobreNos()

    expect(
      screen.getAllByRole('heading', { level: 1 }),
    ).toHaveLength(1)

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  // SEÇÕES INFORMATIVAS

  it('renderiza as cinco seções informativas', () => {
    renderSobreNos()

    for (const titulo of SECOES_ESPERADAS) {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: titulo,
        }),
      ).toBeInTheDocument()
    }
  })

  it('cada seção possui uma região acessível', () => {
    renderSobreNos()

    for (const titulo of SECOES_ESPERADAS) {
      expect(
        screen.getByRole('region', {
          name: titulo,
        }),
      ).toBeInTheDocument()
    }
  })

  // APRESENTAÇÃO DO PROJETO

  it('exibe a apresentação do Elder Web', () => {
    renderSobreNos()

    expect(
      screen.getByText(
        /O Elder Web é uma aplicação web acessível/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /idosas, familiares e cuidadores/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /registros de saúde, organização de medicamentos/i,
      ),
    ).toBeInTheDocument()
  })

  it('exibe o compromisso com acessibilidade', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Nosso compromisso com a acessibilidade',
    })

    expect(
      within(secao).getByText(
        /A acessibilidade é uma prioridade do Elder Web/i,
      ),
    ).toBeInTheDocument()

    expect(
      within(secao).getByText(
        /modos claro e escuro/i,
      ),
    ).toBeInTheDocument()
  })

  // EQUIPE DE DESENVOLVIMENTO

  it('informa quem desenvolveu o projeto', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    expect(
      within(secao).getByText(
        /Trabalho de Conclusão de Curso/i,
      ),
    ).toBeInTheDocument()

    expect(
      within(secao).getByText(
        /Etec Fernando Prestes/i,
        { selector: 'p' },
      ),
    ).toBeInTheDocument()
  })

  it('exibe o título da equipe', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    expect(
      within(secao).getByRole('heading', {
        level: 3,
        name: 'Quem está por trás do Elder Web?',
      }),
    ).toBeInTheDocument()
  })

  it('exibe os três integrantes da equipe', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    for (const integrante of equipe) {
      expect(
        within(secao).getByRole('heading', {
          level: 4,
          name: integrante.nome,
        }),
      ).toBeInTheDocument()
    }
  })

  it('exibe as funções dos integrantes', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    for (const integrante of equipe) {
      const cartao = within(secao)
        .getByRole('heading', {
          level: 4,
          name: integrante.nome,
        })
        .closest('article')

      expect(cartao).not.toBeNull()

      expect(
        within(cartao!).getByText(integrante.cargo),
      ).toBeInTheDocument()
    }
  })

  it('exibe as fotografias individuais', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    for (const integrante of equipe) {
      expect(
        within(secao).getByRole('img', {
          name: `Foto de ${integrante.nome}`,
        }),
      ).toHaveAttribute('src', integrante.foto)
    }
  })

  it('exibe a fotografia coletiva da equipe', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    expect(
      within(secao).getByRole('img', {
        name: equipeColetiva.descricao,
      }),
    ).toHaveAttribute('src', equipeColetiva.foto)

    expect(
      within(secao).getByText(
        /Equipe Elder Web — Etec Fernando Prestes, 2026/i,
      ),
    ).toBeInTheDocument()
  })

  // NAVEGAÇÃO

  it('possui link para a página inicial', () => {
    renderSobreNos()

    expect(
      screen.getByRole('link', {
        name: /voltar ao início/i,
      }),
    ).toHaveAttribute('href', '/')
  })

  it('possui link para entrar ou criar conta', () => {
    renderSobreNos()

    expect(
      screen.getByRole('link', {
        name: /entrar ou criar conta/i,
      }),
    ).toHaveAttribute('href', '/welcome')
  })

  it('possui convite para conhecer o Elder', () => {
    renderSobreNos()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /cuidar também pode ser mais simples/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', {
        name: /conhecer o elder$/i,
      }),
    ).toHaveAttribute('href', '/welcome')
  })

  // ELEMENTOS DECORATIVOS

  it('mantém as quatro folhas decorativas fora da árvore acessível', () => {
    const { container } = renderSobreNos()

    const fundo = container.querySelector(
      'main > div[aria-hidden="true"]',
    )

    expect(fundo).not.toBeNull()

    const folhas = fundo!.querySelectorAll('img[alt=""]')

    expect(folhas).toHaveLength(4)

    for (const folha of folhas) {
      expect(folha).toHaveAttribute('alt', '')
    }
  })

  it('mantém a logo decorativa no topo da página', () => {
    renderSobreNos()

    const titulo = screen.getByRole('heading', {
      level: 1,
      name: /sobre o elder web/i,
    })

    const hero = titulo.closest('section')

    expect(hero).not.toBeNull()

    const logo = hero!.querySelector('img[alt=""]')

    expect(logo).toBeInTheDocument()
  })

  // RESPONSIVIDADE

  it('o selo Conheça o Elder usa fonte de pelo menos 14 px', () => {
    renderSobreNos()

    const selo = screen.getByText('Conheça o Elder')

    expect(selo).toHaveClass('text-sm')
    expect(selo).not.toHaveClass('text-xs')
  })

  it('os títulos dos cards permitem quebra de palavras', () => {
    const { container } = renderSobreNos()

    const titulo = container.querySelector(
      'h2#titulo-acessibilidade',
    )

    expect(titulo).toHaveClass('break-words')
  })

  // CONTEÚDO

  it('não contém termos fora do projeto', () => {
    const { container } = renderSobreNos()

    const texto = container.textContent ?? ''

    expect(texto).not.toMatch(/\bAlexa\b/i)
    expect(texto).not.toMatch(/\bmicrofone\b/i)
    expect(texto).not.toMatch(/\bloja\b/i)
    expect(texto).not.toMatch(/São Vicente/i)
  })

  // ACESSIBILIDADE AUTOMÁTICA

  it('não apresenta violações automáticas de acessibilidade', async () => {
    const { container } = renderSobreNos()

    const resultados = await axe(container, AXE)

    expect(resultados).toHaveNoViolations()
  })
})
