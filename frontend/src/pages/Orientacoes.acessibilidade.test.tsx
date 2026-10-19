
import '@testing-library/jest-dom'

import {
  render,
  screen,
  within,
} from '@testing-library/react'

import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Orientacoes from './Orientacoes'
import { EMAIL_SUPORTE } from '../lib/documentosLegais'
import { secoesOrientacoes } from '../components/orientacoes/dadosOrientacoes'

expect.extend(toHaveNoViolations)

/**
 * Elder Web — Orientações Gerais
 * RF-031 | Item 8.2
 *
 * Testes automatizados de acessibilidade.
 *
 * Limitação:
 * O jsdom não calcula o contraste visual real.
 * O contraste será validado separadamente.
 */

const AXE = {
  rules: {
    'color-contrast': { enabled: false },
    'region': { enabled: false },
  },
}

const SECOES = [
  ...secoesOrientacoes,
  {
    id: 'ajuda',
    titulo: 'Ajuda e aviso importante',
  },
]

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/orientacoes']}>
      <Orientacoes />
    </MemoryRouter>
  )
}

describe('Orientacoes — Acessibilidade (RF-031)', () => {
  describe('Estrutura semântica', () => {
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

    it('não cria um main duplicado', () => {
      renderPagina()

      expect(
        screen.queryByRole('main')
      ).not.toBeInTheDocument()
    })

    it('possui cinco regiões acessíveis', () => {
      renderPagina()

      expect(
        screen.getAllByRole('region')
      ).toHaveLength(5)
    })

    it('associa cada região ao seu título h2', () => {
      renderPagina()

      SECOES.forEach(({ id, titulo }) => {
        const regiao = screen.getByRole('region', {
          name: titulo,
        })

        const heading = within(regiao).getByRole(
          'heading',
          {
            level: 2,
            name: titulo,
          }
        )

        expect(regiao).toHaveAttribute(
          'aria-labelledby',
          id
        )

        expect(heading).toHaveAttribute(
          'id',
          id
        )
      })
    })

    it('mantém a hierarquia correta dos títulos', () => {
      renderPagina()

      const titulos = screen.getAllByRole('heading')

      expect(titulos[0].tagName).toBe('H1')

      expect(
        titulos.slice(1).every(
          (titulo) => titulo.tagName === 'H2'
        )
      ).toBe(true)
    })
  })

  describe('Elementos decorativos', () => {
    it('possui folha decorativa no cabeçalho', () => {
      const { container } = renderPagina()

      const cabecalho = container.querySelector('header')

      expect(cabecalho).toBeInTheDocument()

      const folha = cabecalho?.querySelector('img')

      expect(folha).toBeInTheDocument()

      expect(folha).toHaveAttribute('alt', '')

      expect(folha).toHaveAttribute(
        'aria-hidden',
        'true'
      )

      expect(folha).toHaveClass(
        'pointer-events-none'
      )
    })

    it('não expõe a folha como imagem acessível', () => {
      renderPagina()

      expect(
        screen.queryByRole('img', {
          name: /folha/i,
        })
      ).not.toBeInTheDocument()
    })

    it('não possui imagens decorativas no cartão de ajuda', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(
        ajuda.querySelector('img')
      ).not.toBeInTheDocument()
    })

    it('mantém os ícones das orientações ocultos dos leitores de tela', () => {
      renderPagina()

      secoesOrientacoes.forEach((secao) => {
        const regiao = screen.getByRole('region', {
          name: secao.titulo,
        })

        const icone = regiao.querySelector('svg')

        expect(icone).toBeInTheDocument()

        expect(icone).toHaveAttribute(
          'aria-hidden',
          'true'
        )
      })
    })

    it('mantém a numeração decorativa fora da leitura acessível', () => {
      renderPagina()

      secoesOrientacoes.forEach((secao, index) => {
        const regiao = screen.getByRole('region', {
          name: secao.titulo,
        })

        const numero = String(index + 1).padStart(
          2,
          '0'
        )

        const elemento = within(regiao).getByText(
          numero
        )

        expect(elemento).toHaveAttribute(
          'aria-hidden',
          'true'
        )
      })
    })
  })

  describe('Links e navegação acessível', () => {
    it('possui link de suporte com nome acessível', () => {
      renderPagina()

      const link = screen.getByRole('link', {
        name: EMAIL_SUPORTE,
      })

      expect(link).toHaveAttribute(
        'href',
        `mailto:${EMAIL_SUPORTE}`
      )

      expect(link).toHaveAccessibleName()
    })

    it('possui link acessível para o SAMU 192', () => {
      renderPagina()

      const telefone = screen.getByRole('link', {
        name: 'Ligar para o SAMU no número 192',
      })

      expect(telefone).toHaveAttribute(
        'href',
        'tel:192'
      )

      expect(telefone).toHaveAccessibleName()
    })

    it('mantém foco visível nos links interativos', () => {
      renderPagina()

      const links = [
        screen.getByRole('link', {
          name: EMAIL_SUPORTE,
        }),
        screen.getByRole('link', {
          name: 'Ligar para o SAMU no número 192',
        }),
      ]

      links.forEach((link) => {
        expect(link.className).toContain(
          'focus-visible:outline'
        )
      })
    })
  })

  describe('Auditoria automatizada', () => {
    it('não apresenta violações detectáveis pelo axe', async () => {
      const { container } = renderPagina()

      const resultados = await axe(container, AXE)

      expect(resultados).toHaveNoViolations()
    })
  })
})
