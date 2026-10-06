import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Welcome from './Welcome'

expect.extend(toHaveNoViolations)

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function renderWelcome(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/welcome', state }]}>
      <Welcome />
    </MemoryRouter>
  )
}

describe('Welcome (acessibilidade)', () => {
  it('acesso direto: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderWelcome()
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('com a mensagem role=alert de cadastro realizado: não tem violações detectáveis pelo axe', async () => {
    const { container } = renderWelcome({ cadastroSucesso: true, confirmarEmail: true })
    expect(screen.getByRole('alert')).toHaveTextContent(/cadastro realizado com sucesso/i)
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
