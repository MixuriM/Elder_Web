import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Orientacoes from './Orientacoes'

jest.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => ({ usuario: { uid: 'u1' }, carregando: false }),
}))

const TITULOS = [
  'Como começar',
  'Senha e acesso',
  'Perfis e vínculos',
  'O que você encontra no Elder Web',
  'Ajuda e aviso importante',
]

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/orientacoes']}>
      <Orientacoes />
    </MemoryRouter>
  )
}

describe('Orientacoes', () => {
  it('tem um único h1 "Orientações gerais" e nenhum main próprio (vem do layout)', () => {
    renderPagina()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Orientações gerais' })).toBeInTheDocument()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  it('tem os 5 h2 na ordem, cada um como region nomeada', () => {
    renderPagina()
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(h2).toEqual(TITULOS)
    TITULOS.forEach((t) => expect(screen.getByRole('region', { name: t })).toBeInTheDocument())
  })


  it('link de suporte é mailto: para o e-mail de suporte', () => {
    renderPagina()
    expect(screen.getByRole('link', { name: 'elder.web.suporte@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:elder.web.suporte@gmail.com'
    )
  })

  it('traz o aviso de não enviar saúde por e-mail e o do SAMU 192', () => {
    renderPagina()
    expect(screen.getByText(/não envie valores nem informações de saúde por e-mail/i)).toBeInTheDocument()
    expect(screen.getByText(/SAMU, telefone 192/)).toBeInTheDocument()
  })

  it('não cita termos fora do escopo', () => {
    const { container } = renderPagina()
    const texto = container.textContent ?? ''
    expect(texto).not.toMatch(/alexa/i)
    expect(texto).not.toMatch(/microfone/i)
    expect(texto).not.toMatch(/\bloja\b/i)
    expect(texto).not.toMatch(/são vicente/i)
  })
})
