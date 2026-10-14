import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Privacidade from './Privacidade'
import Termos from './Termos'
import Cookies from './Cookies'

expect.extend(toHaveNoViolations)

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

describe.each([
  ['/privacidade', Privacidade],
  ['/termos', Termos],
  ['/cookies', Cookies],
])('%s (acessibilidade)', (rota, Pagina) => {
  it('tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={[rota]}>
        <Pagina />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
