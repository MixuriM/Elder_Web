import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './LandingPage'

function renderLanding(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<p>Rota welcome</p>} />
        <Route path="/cadastro" element={<p>Rota cadastro</p>} />
        <Route path="/login" element={<p>Rota login</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function expectSoloWelcome() {
  expect(screen.getByText('Rota welcome')).toBeInTheDocument()
  expect(screen.queryByText('Rota cadastro')).not.toBeInTheDocument()
  expect(screen.queryByText('Rota login')).not.toBeInTheDocument()
}

describe('LandingPage: navegação dos botões', () => {
  it('"Entrar" (Navbar) leva a /welcome', async () => {
    renderLanding()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expectSoloWelcome()
  })

  it('"Criar minha conta" (CTASection) leva a /welcome', async () => {
    renderLanding()
    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    expectSoloWelcome()
  })
})

// Exclusão de conta (2026-10-20): depois de excluir, a pessoa volta para cá com o aviso "Conta excluída.".
describe('LandingPage: aviso depois de excluir a conta', () => {
  it('mostra "Conta excluída." como status quando chega com contaExcluida', () => {
    renderLanding({ contaExcluida: true })
    expect(screen.getByRole('status')).toHaveTextContent('Conta excluída.')
  })

  it.each([[undefined], [{}], [{ contaExcluida: false }], [{ contaExcluida: 'sim' }]])(
    'sem o aviso quando o estado é %j',
    (state) => {
      renderLanding(state)
      expect(screen.queryByText('Conta excluída.')).not.toBeInTheDocument()
    },
  )
})
