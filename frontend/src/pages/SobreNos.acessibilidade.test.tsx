import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import SobreNos from './SobreNos'

expect.extend(toHaveNoViolations)

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (pendente: item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

describe('SobreNos (acessibilidade)', () => {
  it('tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/sobre-nos']}>
        <SobreNos />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
