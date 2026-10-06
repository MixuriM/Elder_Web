import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Welcome from './Welcome'

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/cadastro" element={<p>Rota cadastro</p>} />
        <Route path="/login" element={<p>Rota login</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Os botões aparecem em duas cópias no DOM (layout mobile e desktop): as duas precisam navegar.
const COPIAS = [0, 1]

describe('Welcome: navegação dos botões', () => {
  it.each(COPIAS)('"Criar minha conta" (cópia %i) leva a /cadastro', async (i) => {
    renderWelcome()
    const botoes = screen.getAllByRole('button', { name: 'Criar minha conta' })
    expect(botoes).toHaveLength(COPIAS.length)
    await userEvent.click(botoes[i])
    expect(screen.getByText('Rota cadastro')).toBeInTheDocument()
    expect(screen.queryByText('Rota login')).not.toBeInTheDocument()
  })

  it.each(COPIAS)('"Já tenho uma conta" (cópia %i) leva a /login', async (i) => {
    renderWelcome()
    const botoes = screen.getAllByRole('button', { name: 'Já tenho uma conta' })
    expect(botoes).toHaveLength(COPIAS.length)
    await userEvent.click(botoes[i])
    expect(screen.getByText('Rota login')).toBeInTheDocument()
    expect(screen.queryByText('Rota cadastro')).not.toBeInTheDocument()
  })
})
