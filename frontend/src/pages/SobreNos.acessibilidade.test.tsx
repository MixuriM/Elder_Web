
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
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


// LIMITE:
// O jsdom não calcula as cores reais.
// Por isso, o contraste deve ser verificado
// separadamente no navegador.
//
// A existência de um único H1 e de um único main
// é verificada explicitamente nestes testes.

const AXE = {
  rules: {
    'color-contrast': {
      enabled: false,
    },
  },
}

function renderSobreNos() {
  return render(
    <MemoryRouter initialEntries={['/sobre-nos']}>
      <SobreNos />
    </MemoryRouter>,
  )
}

describe('SobreNos (acessibilidade)', () => {
  it('possui um único título principal H1', () => {
    renderSobreNos()

    expect(
      screen.getAllByRole('heading', {
        level: 1,
      }),
    ).toHaveLength(1)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sobre o elder web/i,
      }),
    ).toBeInTheDocument()
  })

  it('possui um único elemento main', () => {
    renderSobreNos()

    expect(
      screen.getAllByRole('main'),
    ).toHaveLength(1)
  })

  it('possui regiões identificadas pelos títulos', () => {
    renderSobreNos()

    const secoes = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]

    secoes.forEach((titulo) => {
      expect(
        screen.getByRole('region', {
          name: titulo,
        }),
      ).toBeInTheDocument()
    })
  })

  it('possui links acessíveis de navegação', () => {
    renderSobreNos()

    const linkInicio = screen.getByRole('link', {
      name: /voltar ao início/i,
    })

    expect(linkInicio).toHaveAttribute(
      'href',
      '/',
    )

    const linkWelcome = screen.getByRole('link', {
      name: /entrar ou criar conta/i,
    })

    expect(linkWelcome).toHaveAttribute(
      'href',
      '/welcome',
    )
  })

  it('possui link acessível para conhecer o Elder', () => {
    renderSobreNos()

    const link = screen.getByRole('link', {
      name: /conhecer o elder$/i,
    })

    expect(link).toHaveAttribute(
      'href',
      '/welcome',
    )
  })

  it('mantém as folhas decorativas ocultas dos leitores de tela', () => {
    const { container } = renderSobreNos()

    const folhas = container.querySelectorAll(
      'img[alt=""]',
    )

    // 4 folhas decorativas + logo decorativa do hero
    expect(folhas).toHaveLength(5)

    folhas.forEach((folha) => {
      expect(folha).toHaveAttribute('alt', '')
    })
  })

  it('possui imagens da equipe com descrição acessível', () => {
    renderSobreNos()

    expect(
      screen.getByRole('img', {
        name: /foto de marcos/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('img', {
        name: /foto de laureane/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('img', {
        name: /foto de jennifer/i,
      }),
    ).toBeInTheDocument()
  })

  it('não possui violações detectáveis pelo axe', async () => {
    const { container } = renderSobreNos()

    const resultado = await axe(
      container,
      AXE,
    )

    expect(resultado).toHaveNoViolations()
  })
})
