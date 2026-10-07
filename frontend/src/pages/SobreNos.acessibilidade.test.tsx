import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import SobreNos from './SobreNos'

expect.extend(toHaveNoViolations)

// LIMITE:
// O jsdom não calcula cores reais, então contraste não é
// verificado neste teste automatizado.
//
// A existência do H1 também é verificada manualmente,
// pois algumas regras de página inteira não são executadas
// normalmente pelo jest-axe.
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
  it('possui um único título principal', () => {
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

  it('possui regiões identificadas pelos títulos das seções', () => {
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

    expect(
      screen.getByRole('link', {
        name: /página inicial/i,
      }),
    ).toHaveAttribute('href', '/')

    expect(
      screen.getByRole('link', {
        name: /entrar ou criar conta/i,
      }),
    ).toHaveAttribute('href', '/welcome')
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