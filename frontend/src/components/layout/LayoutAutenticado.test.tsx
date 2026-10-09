import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import LayoutAutenticado from './LayoutAutenticado'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/auth', () => ({
  logoutUser: jest.fn(),
  onAuthChange: jest.fn(() => () => {}),
}))
jest.mock('../../hooks/useAuthUser', () => ({
  useAuthUser: () => ({ usuario: { displayName: 'Pessoa Teste', email: 'p@teste.com' }, carregando: false }),
}))
jest.mock('../../services/perfilService', () => ({
  buscarPerfil: jest.fn().mockResolvedValue({ nome: 'Pessoa Teste', tipo_perfil: 'idoso' }),
}))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

const ROTAS = [
  ['Início', '/Home'],
  ['Meu Perfil', '/perfil'],
  ['Saúde', '/saude'],
  ['Medicamentos', '/remedios'],
  ['Agenda', '/agenda'],
  ['Alimentação e Nutrição', '/alimentacao'],
  ['Família', '/familia'],
  ['Cuidadores', '/cuidadores'],
  ['Orientações', '/orientacoes'],
] as const

// Cada tela de teste é só um <div> com h1, como as páginas reais dentro do layout.
function renderizar(inicial: string) {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route element={<LayoutAutenticado />}>
          {ROTAS.map(([rotulo, caminho]) => (
            <Route key={caminho} path={caminho} element={<div><h1>Tela {rotulo}</h1></div>} />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('LayoutAutenticado', () => {
  it('tem um único main (id conteudo) com o conteúdo da rota dentro', () => {
    renderizar('/agenda')

    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    expect(mains[0]).toHaveAttribute('id', 'conteudo')
    expect(mains[0]).toContainElement(screen.getByRole('heading', { level: 1, name: 'Tela Agenda' }))
  })

  it('o link "Pular para o conteúdo" é o primeiro foco e leva o foco ao main', async () => {
    const user = userEvent.setup()
    renderizar('/agenda')

    await user.tab()
    const pular = screen.getByRole('link', { name: 'Pular para o conteúdo' })
    expect(pular).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it.each(ROTAS)('menu: "%s" é um link para %s com aria-current só quando ativo', (rotulo, caminho) => {
    renderizar(caminho)

    const nav = screen.getByRole('navigation', { name: 'Menu principal' })
    const link = screen.getByRole('link', { name: rotulo })
    expect(nav).toContainElement(link)
    expect(link).toHaveAttribute('href', caminho)
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('clicar em um item do menu navega para a rota e move o aria-current', async () => {
    const user = userEvent.setup()
    renderizar('/Home')

    await user.click(screen.getByRole('link', { name: 'Cuidadores' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Tela Cuidadores' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cuidadores' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('sem violações detectáveis pelo axe (landmarks sem duplicidade)', async () => {
    const { container } = renderizar('/saude')
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})
