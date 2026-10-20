
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import SobreNos from './SobreNos'

expect.extend(toHaveNoViolations)

// SobreHeader e SobreCTA leem a sessão; aqui a página é vista como visitante.
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

describe('SobreNos (item 8.1, RF-029)', () => {
  it('renderiza a página Sobre nós', () => {
    renderSobreNos()

    expect(
      screen.getByRole('main'),
    ).toBeInTheDocument()

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
      screen.getAllByRole('heading', {
        level: 1,
      }),
    ).toHaveLength(1)

    expect(
      screen.getAllByRole('main'),
    ).toHaveLength(1)
  })

  it('renderiza as cinco seções informativas', () => {
    renderSobreNos()

    const titulos = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]

    titulos.forEach((titulo) => {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: titulo,
        }),
      ).toBeInTheDocument()
    })
  })

  it('cada seção possui uma região acessível', () => {
    renderSobreNos()

    const titulos = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]

    titulos.forEach((titulo) => {
      expect(
        screen.getByRole('region', {
          name: titulo,
        }),
      ).toBeInTheDocument()
    })
  })

  it('exibe a apresentação do Elder Web', () => {
    renderSobreNos()

    expect(
      screen.getByText(
        /O Elder Web é uma aplicação web acessível/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /idosos, cuidadores e familiares/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /registros de saúde, controle de medicamentos/i,
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

  it('exibe as informações de quem fez o projeto', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    expect(
      within(secao).getByText(
        /Projeto de Conclusão de Curso/i,
      ),
    ).toBeInTheDocument()

    expect(
      within(secao).getByText(
        /Etec Fernando Prestes/i,
      ),
    ).toBeInTheDocument()
  })

  it('exibe os três integrantes da equipe', () => {
    renderSobreNos()

    const secao = screen.getByRole('region', {
      name: 'Quem fez',
    })

    const integrantes = [
      'Marcos',
      'Laureane',
      'Jennifer',
    ]

    integrantes.forEach((nome) => {
      expect(
        within(secao).getByRole('heading', {
          level: 3,
          name: nome,
        }),
      ).toBeInTheDocument()
    })
  })

  it('possui link para a página inicial', () => {
    renderSobreNos()

    const linkInicial = screen.getByRole('link', {
      name: /voltar ao início/i,
    })

    expect(linkInicial).toBeInTheDocument()

    expect(linkInicial).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('possui link para entrar ou criar conta', () => {
    renderSobreNos()

    const linkWelcome = screen.getByRole('link', {
      name: /entrar ou criar conta/i,
    })

    expect(linkWelcome).toBeInTheDocument()

    expect(linkWelcome).toHaveAttribute(
      'href',
      '/welcome',
    )
  })

  it('possui convite para conhecer o Elder', () => {
    renderSobreNos()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /cuidar também pode ser mais simples/i,
      }),
    ).toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: /conhecer o elder$/i,
    })

    expect(link).toHaveAttribute(
      'href',
      '/welcome',
    )
  })

  it('mantém as folhas decorativas fora da árvore acessível', () => {
    const { container } = renderSobreNos()

    const imagensDecorativas = container.querySelectorAll(
      'img[alt=""]',
    )

    expect(imagensDecorativas).toHaveLength(3)

    imagensDecorativas.forEach((imagem) => {
      expect(imagem).toHaveAttribute('alt', '')
    })
  })

  it('não contém termos proibidos', () => {
    const { container } = renderSobreNos()

    const texto = container.textContent ?? ''

    expect(texto).not.toMatch(/\bAlexa\b/i)
    expect(texto).not.toMatch(/\bmicrofone\b/i)
    expect(texto).not.toMatch(/\bloja\b/i)
    expect(texto).not.toMatch(/São Vicente/i)
  })

  it('não apresenta violações automáticas de acessibilidade', async () => {
    const { container } = renderSobreNos()

    const resultados = await axe(container, AXE)

    expect(resultados).toHaveNoViolations()
  })
})
