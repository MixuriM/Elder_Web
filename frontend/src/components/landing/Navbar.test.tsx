import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import Navbar from './Navbar'

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Navbar onEntrar={() => {}} />} />
        <Route path="/orientacoes" element={<p>Rota orientações</p>} />
        <Route path="/sobre-nos" element={<p>Rota sobre nós</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Navbar da landing: links de informação', () => {
  it('ordem no DOM: Início, Funcionalidades, Para quem é, Acessibilidade, Orientações, Sobre, depois Entrar', () => {
    renderNavbar()
    const nomes = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)
    const esperados = ['Início', 'Funcionalidades', 'Para quem é', 'Acessibilidade', 'Orientações', 'Sobre']
    const posicoes = esperados.map((n) => nomes.indexOf(n))
    expect(posicoes.every((p) => p >= 0)).toBe(true)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
    // Depois do Sobre vêm só o tema e o Entrar.
    expect(nomes.indexOf('Entrar')).toBeGreaterThan(posicoes[5])
    expect(nomes[nomes.length - 1]).toBe('Entrar')
  })

  it('"Orientações" leva a /orientacoes', async () => {
    renderNavbar()
    await userEvent.click(screen.getByRole('button', { name: 'Orientações' }))
    expect(screen.getByText('Rota orientações')).toBeInTheDocument()
  })

  it('"Sobre" segue levando a /sobre-nos', async () => {
    renderNavbar()
    await userEvent.click(screen.getByRole('button', { name: 'Sobre' }))
    expect(screen.getByText('Rota sobre nós')).toBeInTheDocument()
  })

  it('"Sobre" fica no mesmo grupo de "Orientações", logo depois dele', () => {
    renderNavbar()
    const orientacoes = screen.getByRole('button', { name: 'Orientações' })
    const sobre = screen.getByRole('button', { name: 'Sobre' })
    expect(sobre.parentElement).toBe(orientacoes.parentElement)
    expect(orientacoes.nextElementSibling).toBe(sobre)
  })

  it('o bloco da direita tem só o tema e o Entrar', () => {
    renderNavbar()
    const direita = screen.getByRole('button', { name: 'Entrar' }).parentElement as HTMLElement
    expect(within(direita).queryByRole('button', { name: 'Sobre' })).not.toBeInTheDocument()
  })

  it('o botão de tema tem nome acessível em todas as larguras (compacto e com rótulo)', () => {
    const { container } = renderNavbar()
    const temas = Array.from(container.querySelectorAll('button[aria-pressed]'))
    expect(temas.length).toBeGreaterThanOrEqual(2)
    temas.forEach((t) => expect(t).toHaveAccessibleName(/Ativar modo (claro|escuro)/))
  })
})
