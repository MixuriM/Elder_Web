import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SobreNos from './SobreNos'

function renderSobreNos() {
  return render(
    <MemoryRouter initialEntries={['/sobre-nos']}>
      <SobreNos />
    </MemoryRouter>,
  )
}

describe('SobreNos (item 8.1, RF-029)', () => {
  it('renderiza a página Sobre nós', () => {
    renderSobreNos()

    expect(screen.getByRole('main')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sobre nós/i,
      }),
    ).toBeInTheDocument()
  })

  it('possui apenas um h1 e um main', () => {
    renderSobreNos()

    expect(
      screen.getAllByRole('heading', {
        level: 1,
      }),
    ).toHaveLength(1)

    expect(
      screen.getAllByRole('main'),
    ).toHaveLength(1)
  })

  it('renderiza as 5 seções do Sobre nós', () => {
    renderSobreNos()

    const titulos = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]

    titulos.forEach((titulo) => {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: titulo,
        }),
      ).toBeInTheDocument()
    })
  })

  it('cada seção possui uma região acessível', () => {
    renderSobreNos()

    const titulos = [
      'O que é o Elder Web',
      'Para quem é',
      'O que reúne',
      'Nosso compromisso com a acessibilidade',
      'Quem fez',
    ]

    titulos.forEach((titulo) => {
      expect(
        screen.getByRole('region', {
          name: titulo,
        }),
      ).toBeInTheDocument()
    })
  })

  it('exibe as informações sobre o Elder Web', () => {
    renderSobreNos()

    expect(
      screen.getByText(
        /O Elder Web é uma aplicação web que apoia idosos/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Para o idoso, o cuidador e o familiar/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Registro de saúde/i,
      ),
    ).toBeInTheDocument()
  })

  it('exibe o compromisso com acessibilidade', () => {
    renderSobreNos()

    expect(
      screen.getByText(
        /Buscamos letras grandes, bom contraste/i,
      ),
    ).toBeInTheDocument()
  })

  it('exibe as informações de quem fez o projeto', () => {
    renderSobreNos()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Quem fez',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Projeto de Conclusão de Curso/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Etec Fernando Prestes/i,
      ),
    ).toBeInTheDocument()
  })

  it('exibe os integrantes da equipe', () => {
    renderSobreNos()

    expect(
      screen.getByText('Marcos'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Laureane'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Jennifer'),
    ).toBeInTheDocument()
  })

  it('possui link para a página inicial', () => {
    renderSobreNos()

    const linkInicial = screen.getByRole('link', {
      name: /página inicial/i,
    })

    expect(linkInicial).toBeInTheDocument()
    expect(linkInicial).toHaveAttribute('href', '/')
  })

  it('possui link para entrar ou criar conta', () => {
    renderSobreNos()

    const linkWelcome = screen.getByRole('link', {
      name: /entrar ou criar conta/i,
    })

    expect(linkWelcome).toBeInTheDocument()
    expect(linkWelcome).toHaveAttribute(
      'href',
      '/welcome',
    )
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