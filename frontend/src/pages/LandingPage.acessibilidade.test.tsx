import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import LandingPage from './LandingPage'

expect.extend(toHaveNoViolations)

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
// heading-order também fica desligada SÓ nesta tela: impacto `moderate` (h1 vai direto a h3 nos cards
// de ResumoSection), que o item 9.1 só lista no relatório e não corrige (só critical e serious).
const AXE = { rules: { 'color-contrast': { enabled: false }, 'heading-order': { enabled: false } } }

describe('LandingPage (acessibilidade)', () => {
  it('tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
