import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Home from './Home'

expect.extend(toHaveNoViolations)

// Mesmo mock do Home.test.tsx: Sidebar e Header usam auth.ts, sem inicializar Firebase.
jest.mock('../lib/auth', () => ({
  logoutUser: jest.fn(),
  onAuthChange: jest.fn(() => () => {}),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

describe('Home (acessibilidade)', () => {
  it('tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/Home']}>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
