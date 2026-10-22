
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
// Essa verificação deve ser realizada no navegador,
// utilizando ferramentas como Playwright.

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
    titulo: 'Política de Cookies e armazenamento no navegador',
    Componente: Cookies,
  },
]

// ==========================================
// TESTES DE ACESSIBILIDADE
// ==========================================

describe.each(paginasLegais)(
  '$titulo - acessibilidade',
  ({ rota, titulo, Componente }) => {

    // ======================================
    // RENDERIZAÇÃO
    // ======================================

    function renderizarPagina() {
      return render(
        <MemoryRouter initialEntries={[rota]}>
          <Componente />
        </MemoryRouter>,
      )
    }

    // ======================================
    // TÍTULO PRINCIPAL
    // ======================================

    it('renderiza o título principal da página', () => {
      renderizarPagina()

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: titulo,
        }),
      ).toBeInTheDocument()
    })

    // ======================================
    // H1 ÚNICO
    // ======================================

    it('possui apenas um h1', () => {
      renderizarPagina()

      const titulos = screen.getAllByRole('heading', {
        level: 1,
      })

      expect(titulos).toHaveLength(1)
    })

    // ======================================
    // CONTEÚDO PRINCIPAL ÚNICO
    // ======================================

    it('possui apenas um conteúdo principal', () => {
      renderizarPagina()

      const conteudos = screen.getAllByRole('main')

      expect(conteudos).toHaveLength(1)
    })

    // ======================================
    // VERIFICAÇÃO AUTOMÁTICA
    // ======================================

    it(
      'não apresenta violações automáticas de acessibilidade',
      async () => {
        const { container } = renderizarPagina()

        const resultados = await axe(container, AXE)

        expect(resultados).toHaveNoViolations()
      },
    )
  },
)
