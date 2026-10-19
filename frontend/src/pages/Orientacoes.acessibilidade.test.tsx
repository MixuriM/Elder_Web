
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Orientacoes from './Orientacoes'

expect.extend(toHaveNoViolations)

// LIMITE: jsdom não calcula cores reais.
// O contraste será validado separadamente (item 9.1).
// A regra page-has-heading-one é verificada manualmente.

const AXE = {
  rules: {
    'color-contrast': { enabled: false },
  },
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/orientacoes']}>
      <Orientacoes />
    </MemoryRouter>
  )
}

describe('Orientacoes — Acessibilidade (RF-031)', () => {
  it('possui exatamente um título principal h1', () => {
    renderPagina()

    const titulos = screen.getAllByRole('heading', {
      level: 1,
    })

    expect(titulos).toHaveLength(1)

    expect(titulos[0]).toHaveTextContent(
      'Orientações gerais'
    )
  })

  it('não possui main próprio, pois utiliza o layout', () => {
    renderPagina()

    expect(
      screen.queryByRole('main')
    ).not.toBeInTheDocument()
  })

  it('possui regiões acessíveis com títulos associados', () => {
    renderPagina()

    const titulos = [
      'Como começar',
      'Senha e acesso',
      'Perfis e vínculos',
      'O que você encontra no Elder Web',
      'Ajuda e aviso importante',
    ]

    titulos.forEach((titulo) => {
      const regiao = screen.getByRole('region', {
        name: titulo,
      })

      expect(regiao).toBeInTheDocument()

      expect(
        within(regiao).getByRole('heading', {
          level: 2,
          name: titulo,
        })
      ).toBeInTheDocument()
    })
  })

  it('possui link de suporte acessível', () => {
    renderPagina()

    const link = screen.getByRole('link', {
      name: 'elder.web.suporte@gmail.com',
    })

    expect(link).toHaveAttribute(
      'href',
      'mailto:elder.web.suporte@gmail.com'
    )

    expect(link).toHaveAccessibleName()
  })

  it('possui link acessível para o SAMU 192', () => {
    renderPagina()

    const telefone = screen.getByRole('link', {
      name: /Ligar para o SAMU no número 192/i,
    })

    expect(telefone).toHaveAttribute(
      'href',
      'tel:192'
    )

    expect(telefone).toHaveAccessibleName()
  })

  it('não apresenta violações detectáveis pelo axe', async () => {
    const { container } = renderPagina()

    const resultados = await axe(container, AXE)

    expect(resultados).toHaveNoViolations()
  })
})
