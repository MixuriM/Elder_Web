import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SobreNos from './SobreNos'

const mockUseAuthUser = jest.fn()
jest.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => mockUseAuthUser(),
}))

function renderSobreNos() {
  mockUseAuthUser.mockReturnValue({ usuario: null, carregando: false })
  return render(
    <MemoryRouter initialEntries={['/sobre-nos']}>
      <SobreNos />
    </MemoryRouter>
  )
}

describe('SobreNos (item 8.1, RF-029)', () => {
  it('tem um único h1 "Sobre nós" e um único main', () => {
    renderSobreNos()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Sobre nós' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('tem as 5 seções, cada uma com seu h2', () => {
    renderSobreNos()
    const titulos = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(titulos)
    titulos.forEach((t) => {
      expect(screen.getByRole('region', { name: t })).toBeInTheDocument()
    })
  })

  it('link para a página inicial', () => {
    renderSobreNos()
    expect(screen.getByRole('link', { name: 'Voltar para a página inicial' })).toHaveAttribute('href', '/')
  })

  it('link para entrar ou criar conta aponta para /welcome', () => {
    renderSobreNos()
    expect(screen.getByRole('link', { name: 'Entrar ou criar conta' })).toHaveAttribute('href', '/welcome')
  })

  it('não contém termos proibidos', () => {
    const { container } = renderSobreNos()
    const texto = container.textContent ?? ''
    expect(texto).not.toMatch(/\bAlexa\b/i)
    expect(texto).not.toMatch(/\bmicrofone\b/i)
    expect(texto).not.toMatch(/\bloja\b/i)
    expect(texto).not.toMatch(/São Vicente/i)
  })
})
