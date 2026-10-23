
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Footer from './Footer'

// ==========================================
// RENDERIZAÇÃO
// ==========================================

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

// ==========================================
// TESTES DO FOOTER
// ==========================================

describe('Footer da landing - Elder Web', () => {
  // DOCUMENTOS LEGAIS

  it('exibe os três documentos legais', () => {
    renderFooter()

    const nav = screen.getByRole('navigation', {
      name: 'Documentos legais',
    })

    expect(
      within(nav).getByRole('link', {
        name: 'Política de Privacidade',
      }),
    ).toHaveAttribute('href', '/privacidade')

    expect(
      within(nav).getByRole('link', {
        name: 'Termos de Uso',
      }),
    ).toHaveAttribute('href', '/termos')

    expect(
      within(nav).getByRole('link', {
        name: /Política de Cookies/i,
      }),
    ).toHaveAttribute('href', '/cookies')

    expect(
      within(nav).getAllByRole('link'),
    ).toHaveLength(3)
  })

  // LINKS DE NAVEGAÇÃO

  it('exibe a seção Explore', () => {
    renderFooter()

    const nav = screen.getByRole('navigation', {
      name: 'Ajuda e informações',
    })

    expect(
      within(nav).getByRole('link', {
        name: 'Orientações gerais',
      }),
    ).toHaveAttribute('href', '/orientacoes')

    expect(
      within(nav).getByRole('link', {
        name: 'Sobre nós',
      }),
    ).toHaveAttribute('href', '/sobre-nos')

    expect(
      within(nav).getAllByRole('link'),
    ).toHaveLength(2)
  })

  // LOGO

  it('possui link na logo para a página inicial', () => {
    renderFooter()

    const link = screen.getByRole('link', {
      name: /elder/i,
    })

    expect(link).toHaveAttribute('href', '/')
  })

  // IDENTIDADE DO PROJETO

  it('exibe a mensagem institucional', () => {
    renderFooter()

    expect(
      screen.getByText(
        /Tecnologia para uma vida com mais significado/i,
      ),
    ).toBeInTheDocument()
  })

  it('identifica a instituição responsável pelo projeto', () => {
    renderFooter()

    expect(
      screen.getByText(
        /Projeto acadêmico — Etec Fernando Prestes/i,
      ),
    ).toBeInTheDocument()
  })

  // DIREITOS AUTORAIS

  it('exibe o ano atual no copyright', () => {
    renderFooter()

    const anoAtual = new Date().getFullYear()

    expect(
      screen.getByText(
        new RegExp(
          `${anoAtual} Elder Web\\. Todos os direitos reservados`,
          'i',
        ),
      ),
    ).toBeInTheDocument()
  })
})
