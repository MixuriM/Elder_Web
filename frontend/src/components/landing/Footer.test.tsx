import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Footer from './Footer'

describe('Footer da landing: documentos legais', () => {
  it('tem um nav com os três documentos', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Documentos legais' })
    expect(within(nav).getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
    expect(within(nav).getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos')
    expect(within(nav).getByRole('link', { name: /Política de Cookies/ })).toHaveAttribute('href', '/cookies')
  })

  it('tem um nav "Ajuda e informações" com Orientações gerais e Sobre nós', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Ajuda e informações' })
    expect(within(nav).getByRole('link', { name: 'Orientações gerais' })).toHaveAttribute('href', '/orientacoes')
    expect(within(nav).getByRole('link', { name: 'Sobre nós' })).toHaveAttribute('href', '/sobre-nos')
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
  })
})
