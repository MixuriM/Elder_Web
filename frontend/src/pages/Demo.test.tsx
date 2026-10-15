import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Demo from './Demo'

expect.extend(toHaveNoViolations)

// Modo demonstração (D7): /demo é pública e fora do menu. Antes do login não diz que é uma demonstração; com o modo
// desligado (404) mostra "não encontrada" e sai da conta. Contas e tokens FICTÍCIOS.
const mockLoginUser = jest.fn()
const mockLoginWithGoogle = jest.fn()
const mockLogoutUser = jest.fn()
const mockEntrarComTokenDemo = jest.fn()
jest.mock('../lib/auth', () => ({
  loginUser: (...a: unknown[]) => mockLoginUser(...a),
  loginWithGoogle: (...a: unknown[]) => mockLoginWithGoogle(...a),
  logoutUser: (...a: unknown[]) => mockLogoutUser(...a),
  entrarComTokenDemo: (...a: unknown[]) => mockEntrarComTokenDemo(...a),
}))
const mockChamarApi = jest.fn()
jest.mock('../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))
const mockIrPara = jest.fn()
jest.mock('../lib/recarregar', () => ({ irPara: (...a: unknown[]) => mockIrPara(...a) }))

const AXE = { rules: { 'color-contrast': { enabled: false } } }
const CONTAS = [
  { slug: 'idosa-helena', nome: 'Helena Prado', tipo_perfil: 'idoso', descricao: 'Idosa que decide por si.' },
  { slug: 'idoso-antonio', nome: 'Antônio Ribeiro', tipo_perfil: 'idoso', descricao: 'Decisão com a família.' },
  { slug: 'cuidadora-marta', nome: 'Marta Souza', tipo_perfil: 'cuidador', descricao: 'Cuidadora.' },
  { slug: 'cuidador-paulo', nome: 'Paulo Lima', tipo_perfil: 'cuidador', descricao: 'Pedido pendente.' },
  { slug: 'familiar-carlos', nome: 'Carlos Prado', tipo_perfil: 'familiar', descricao: 'Só lê.' },
  { slug: 'familiar-renata', nome: 'Renata Ribeiro', tipo_perfil: 'familiar', descricao: 'Decide por Antônio.' },
]
const erroHttp = (status: number) => Object.assign(new Error('texto do servidor'), { status })

let armazenamento: jest.SpyInstance[]
beforeEach(() => {
  for (const m of [mockLoginUser, mockLoginWithGoogle, mockLogoutUser, mockEntrarComTokenDemo, mockChamarApi, mockIrPara]) m.mockReset()
  mockLoginUser.mockResolvedValue({})
  mockLoginWithGoogle.mockResolvedValue({})
  mockLogoutUser.mockResolvedValue(undefined)
  mockEntrarComTokenDemo.mockResolvedValue({})
  armazenamento = [
    jest.spyOn(Storage.prototype, 'setItem'),
    jest.spyOn(Storage.prototype, 'getItem'),
  ]
})
afterEach(() => {
  for (const s of armazenamento) expect(s).not.toHaveBeenCalled()
  jest.restoreAllMocks()
})

function renderizar() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/demo']}>
      <Demo />
    </MemoryRouter>,
  )
  return user
}

async function entrarComSenha(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('E-mail'), 'admin@exemplo.test')
  await user.type(screen.getByLabelText('Senha'), 'senha-ficticia')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('/demo: entrada', () => {
  it('antes do login só mostra o formulário (sem falar em demonstração) e sem violação axe', async () => {
    const { container } = render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Acesso restrito' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/demonstra/i)
    expect(mockChamarApi).not.toHaveBeenCalled()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it.each([[404], [500]])('estado responde %i: mostra "não encontrada" e sai da conta', async (status) => {
    mockChamarApi.mockRejectedValue(erroHttp(status))
    const user = renderizar()
    await entrarComSenha(user)
    expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(mockLogoutUser).toHaveBeenCalledTimes(1)
    expect(document.body).not.toHaveTextContent(/demonstra|Helena/i)
    expect(mockChamarApi).toHaveBeenCalledWith('/demo/estado')
  })

  it('senha errada: mensagem fixa, sem chamar o backend', async () => {
    mockLoginUser.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }))
    const user = renderizar()
    await entrarComSenha(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar.')
    expect(mockChamarApi).not.toHaveBeenCalled()
  })
})

describe('/demo: escolha da conta', () => {
  beforeEach(() => {
    mockChamarApi.mockImplementation(async (caminho: string) =>
      caminho === '/demo/estado' ? { contas: CONTAS, atual: null } : { token: 'token-ficticio' },
    )
  })

  it('lista as 6 contas agrupadas por perfil, sem violação axe', async () => {
    const user = renderizar()
    await entrarComSenha(user)
    expect(await screen.findByRole('heading', { level: 1, name: 'Modo demonstração' })).toBeInTheDocument()
    expect(screen.getByText('Todos os dados são fictícios.')).toBeInTheDocument()
    for (const [grupo, nomes] of [
      ['Idoso', ['Helena Prado', 'Antônio Ribeiro']],
      ['Cuidador', ['Marta Souza', 'Paulo Lima']],
      ['Familiar', ['Carlos Prado', 'Renata Ribeiro']],
    ] as const) {
      const secao = screen.getByRole('region', { name: grupo })
      expect(within(secao).getAllByRole('button').map((b) => b.textContent)).toEqual(nomes.map((n) => expect.stringContaining(n)))
    }
    expect(await axe(document.body, AXE)).toHaveNoViolations()
  })

  it('clicar numa conta pede o token, entra com ele e recarrega em /Home', async () => {
    const user = renderizar()
    await entrarComSenha(user)
    await user.click(await screen.findByRole('button', { name: /Marta Souza/ }))
    expect(mockChamarApi).toHaveBeenCalledWith('/demo/entrar-como', { method: 'POST', body: JSON.stringify({ conta: 'cuidadora-marta' }) })
    expect(mockEntrarComTokenDemo).toHaveBeenCalledWith('token-ficticio')
    expect(mockIrPara).toHaveBeenCalledWith('/Home')
  })

  it('também entra com Google', async () => {
    const user = renderizar()
    await user.click(screen.getByRole('button', { name: 'Entrar com Google' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Modo demonstração' })).toBeInTheDocument()
    expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('falha ao trocar de conta: aviso fixo e nenhum redirecionamento', async () => {
    mockChamarApi.mockImplementation(async (caminho: string) => {
      if (caminho === '/demo/estado') return { contas: CONTAS, atual: null }
      throw erroHttp(429)
    })
    const user = renderizar()
    await entrarComSenha(user)
    await user.click(await screen.findByRole('button', { name: /Helena Prado/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar nessa conta. Tente de novo.')
    expect(mockIrPara).not.toHaveBeenCalled()
  })
})
