
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
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

describe('Orientacoes — RF-031 | Item 8.2', () => {
  describe('Estrutura e acessibilidade', () => {
    it('possui somente um h1 com o título correto', () => {
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

    it('não cria main duplicado', () => {
      renderPagina()

      expect(
        screen.queryByRole('main')
      ).not.toBeInTheDocument()
    })

    it('exibe cinco títulos h2 na ordem correta', () => {
      renderPagina()

      const titulos = screen
        .getAllByRole('heading', { level: 2 })
        .map((elemento) => elemento.textContent)

      expect(titulos).toEqual(TITULOS)
    })

    it('possui cinco regiões acessíveis', () => {
      renderPagina()

      expect(
        screen.getAllByRole('region')
      ).toHaveLength(5)
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

    it('associa os títulos às seções por aria-labelledby', () => {
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

        expect(heading).toHaveAttribute('id', id)
      })
    })
  })

  describe('Conteúdo das orientações', () => {
    it('exibe as quatro orientações cadastradas', () => {
      renderPagina()

      expect(secoesOrientacoes).toHaveLength(4)

      secoesOrientacoes.forEach((secao) => {
        const regiao = screen.getByRole('region', {
          name: secao.titulo,
        })

        expect(regiao).toHaveTextContent(
          secao.texto
        )
      })
    })

    it('apresenta informações sobre cadastro e acesso', () => {
      renderPagina()

      const regiao = screen.getByRole('region', {
        name: 'Como começar',
      })

      expect(regiao).toHaveTextContent(/conta Google/i)
      expect(regiao).toHaveTextContent(/confirme o e-mail/i)
    })

    it('orienta sobre recuperação de senha', () => {
      renderPagina()

      const regiao = screen.getByRole('region', {
        name: 'Senha e acesso',
      })

      expect(regiao).toHaveTextContent(
        /Esqueci minha senha/i
      )
    })

    it('explica os vínculos entre cuidadores e idosos', () => {
      renderPagina()

      const regiao = screen.getByRole('region', {
        name: 'Perfis e vínculos',
      })

      expect(regiao).toHaveTextContent(
        /vínculo aprovado/i
      )
    })

    it('informa as funcionalidades disponíveis', () => {
      renderPagina()

      const regiao = screen.getByRole('region', {
        name: 'O que você encontra no Elder Web',
      })

      const funcionalidades = [
        /Saúde/i,
        /Remédios/i,
        /Agenda/i,
        /Alimentação/i,
      ]

      funcionalidades.forEach((funcionalidade) => {
        expect(regiao).toHaveTextContent(
          funcionalidade
        )
      })
    })
  })

  describe('Identidade visual e decoração', () => {
    it('exibe a folha decorativa no cabeçalho', () => {
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

    it('não exibe folhas no cartão de ajuda', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(
        ajuda.querySelector('img')
      ).not.toBeInTheDocument()
    })

    it('mantém os cartões de orientação sem hover', () => {
      renderPagina()

      secoesOrientacoes.forEach((secao) => {
        const cartao = screen.getByRole('region', {
          name: secao.titulo,
        })

        const classes = cartao.className

        expect(classes).not.toMatch(/hover:/)
        expect(classes).not.toMatch(/cursor-pointer/)
        expect(classes).not.toMatch(/transition-/)
      })
    })

    it('mantém o cartão de ajuda sem hover', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(ajuda.className).not.toMatch(/hover:/)
      expect(ajuda.className).not.toMatch(
        /cursor-pointer/
      )
    })

    it('mantém os ícones decorativos fora da leitura acessível', () => {
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

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(ajuda).toHaveTextContent(
        /não envie valores nem informações de saúde por e-mail/i
      )
    })

    it('informa que o Elder não substitui profissionais de saúde', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(ajuda).toHaveTextContent(
        /não substitui consulta nem orientação de profissionais de saúde/i
      )
    })

    it('exibe o telefone de emergência do SAMU', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(ajuda).toHaveTextContent(
        /Em emergência, ligue para o SAMU/i
      )

      const telefone = within(ajuda).getByRole(
        'link',
        {
          name: 'Ligar para o SAMU no número 192',
        }
      )

      expect(telefone).toHaveAttribute(
        'href',
        'tel:192'
      )

      expect(telefone).toHaveTextContent('192')
    })

    it('mantém os três avisos importantes', () => {
      renderPagina()

      const ajuda = screen.getByRole('region', {
        name: 'Ajuda e aviso importante',
      })

      expect(ajuda).toHaveTextContent(
        /não envie valores/i
      )

      expect(ajuda).toHaveTextContent(
        /não substitui consulta/i
      )

      expect(ajuda).toHaveTextContent(
        /Em emergência/i
      )
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
