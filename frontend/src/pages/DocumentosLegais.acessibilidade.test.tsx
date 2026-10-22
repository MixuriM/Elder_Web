
import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Privacidade from './Privacidade'
import Termos from './Termos'
import Cookies from './Cookies'

expect.extend(toHaveNoViolations)

// ==========================================
// CONFIGURAÇÃO DE ACESSIBILIDADE
// ==========================================

// O jsdom não calcula o contraste real das cores.
// Essa verificação deve ser feita no navegador,
// por exemplo, utilizando Playwright.
//
// A existência de um único h1 é verificada
// manualmente nos testes.

const AXE = {
  rules: {
    'color-contrast': { enabled: false },
  },
}

// ==========================================
// PÁGINAS LEGAIS
// ==========================================

const paginasLegais = [
  {
    rota: '/privacidade',
    titulo: 'Política de Privacidade',
    Componente: Privacidade,
  },
  {
    rota: '/termos',
    titulo: 'Termos de Uso',
    Componente: Termos,
  },
  {
    rota: '/cookies',
    titulo: 'Política de Cookies',
    Componente: Cookies,
  },
]

// ==========================================
// TESTES
// ==========================================

describe.each(paginasLegais)(
  '$titulo - acessibilidade',
  ({ rota, titulo, Componente }) => {
    function renderizarPagina() {
      return render(
        <MemoryRouter initialEntries={[rota]}>
          <Componente />
        </MemoryRouter>,
      )
    }

    it('renderiza o título principal da página', () => {
      renderizarPagina()

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: titulo,
        }),
      ).toBeInTheDocument()
    })

    it('possui apenas um h1', () => {
      renderizarPagina()

      expect(
        screen.getAllByRole('heading', {
          level: 1,
        }),
      ).toHaveLength(1)
    })

    it('possui apenas um conteúdo principal', () => {
      renderizarPagina()

      expect(
        screen.getAllByRole('main'),
      ).toHaveLength(1)
    })

    it('não apresenta violações automáticas de acessibilidade', async () => {
      const { container } = renderizarPagina()

      const resultados = await axe(container, AXE)

      expect(resultados).toHaveNoViolations()
    })
  },
)
