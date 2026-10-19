
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Orientacoes from './Orientacoes'
import { EMAIL_SUPORTE } from '../lib/documentosLegais'
import { secoesOrientacoes } from '../components/orientacoes/dadosOrientacoes'

jest.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => ({
    usuario: { uid: 'u1' },
    carregando: false,
  }),
}))

const TITULOS = [
  ...secoesOrientacoes.map((secao) => secao.titulo),
  'Ajuda e aviso importante',
]

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/orientacoes']}>
      <Orientacoes />
    </MemoryRouter>
  )
}

describe('Orientacoes — RF-031', () => {
  describe('Estrutura e acessibilidade', () => {
    it('possui apenas um h1 com o título correto', () => {
      renderPagina()

      const titulos = screen.getAllByRole('heading', {
        level: 1,
      })

      expect(titulos).toHaveLength(1)

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Orientações gerais',
        })
      ).toBeInTheDocument()
    })

    it('não possui main próprio, pois utiliza o layout', () => {
      renderPagina()

      expect(
        screen.queryByRole('main')
      ).not.toBeInTheDocument()
    })

    it('exibe os cinco títulos h2 na ordem correta', () => {
      renderPagina()

      const titulos = screen
        .getAllByRole('heading', { level: 2 })
        .map((elemento) => elemento.textContent)

      expect(titulos).toEqual(TITULOS)
    })

    it('cada seção possui uma região acessível nomeada', () => {
      renderPagina()

      TITULOS.forEach((titulo) => {
        expect(
          screen.getByRole('region', {
            name: titulo,
          })
        ).toBeInTheDocument()
      })
    })

    it('cada seção possui um título associado por aria-labelledby', () => {
      renderPagina()

      const secoes = [
        ...secoesOrientacoes,
        {
          id: 'ajuda',
          titulo: 'Ajuda e aviso importante',
        },
      ]

      secoes.forEach(({ id, titulo }) => {
        const regiao = screen.getByRole('region', {
          name: titulo,
        })

        const heading = screen.getByRole('heading', {
          level: 2,
          name: titulo,
        })

        expect(regiao).toHaveAttribute(
          'aria-labelledby',
          id
        )

        expect(heading).toHaveAttribute('id', id)
      })
    })
  })

  describe('Conteúdo das orientações', () => {
    it('exibe todas as orientações cadastradas', () => {
      renderPagina()

      secoesOrientacoes.forEach((secao) => {
        expect(
          screen.getByText(secao.texto)
        ).toBeInTheDocument()
      })
    })

    it('apresenta informações sobre cadastro e acesso', () => {
      renderPagina()

      expect(
        screen.getByText(/conta Google/i)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/confirme o e-mail/i)
      ).toBeInTheDocument()
    })

    it('orienta sobre recuperação de senha', () => {
      renderPagina()

      expect(
        screen.getByText(/Esqueci minha senha/i)
      ).toBeInTheDocument()
    })

    it('explica os vínculos entre cuidadores e idosos', () => {
      renderPagina()

      expect(
        screen.getByText(/vínculo aprovado/i)
      ).toBeInTheDocument()
    })

    it('informa as funcionalidades disponíveis', () => {
      renderPagina()

      const funcionalidades = [
        /Saúde/i,
        /Remédios/i,
        /Agenda/i,
        /Alimentação/i,
      ]

      const regiao = screen.getByRole('region', {
        name: 'O que você encontra no Elder Web',
      })

      funcionalidades.forEach((funcionalidade) => {
        expect(
          regiao.textContent
        ).toMatch(funcionalidade)
      })
    })
  })

  describe('Suporte e avisos importantes', () => {
    it('possui link mailto para o suporte', () => {
      renderPagina()

      const linkSuporte = screen.getByRole('link', {
        name: EMAIL_SUPORTE,
      })

      expect(linkSuporte).toHaveAttribute(
        'href',
        `mailto:${EMAIL_SUPORTE}`
      )
    })

    it('orienta a não enviar dados de saúde por e-mail', () => {
      renderPagina()

      expect(
        screen.getByText(
          /não envie valores nem informações de saúde por e-mail/i
        )
      ).toBeInTheDocument()
    })

    it('informa que o Elder não substitui profissionais de saúde', () => {
      renderPagina()

      expect(
        screen.getByText(
          /não substitui consulta nem orientação de profissionais de saúde/i
        )
      ).toBeInTheDocument()
    })

    it('exibe o número de emergência do SAMU', () => {
      renderPagina()

      expect(
        screen.getByText(/Em emergência, ligue para o SAMU/i)
      ).toBeInTheDocument()

      const telefone = screen.getByRole('link', {
        name: /Ligar para o SAMU no número 192/i,
      })

      expect(telefone).toHaveAttribute(
        'href',
        'tel:192'
      )

      expect(telefone).toHaveTextContent('192')
    })
  })

  describe('Validação de escopo', () => {
    it('não apresenta termos fora do escopo do Elder Web', () => {
      const { container } = renderPagina()

      const texto = container.textContent ?? ''

      const termosProibidos = [
        /alexa/i,
        /microfone/i,
        /\bloja\b/i,
        /são vicente/i,
      ]

      termosProibidos.forEach((termo) => {
        expect(texto).not.toMatch(termo)
      })
    })
  })
})
