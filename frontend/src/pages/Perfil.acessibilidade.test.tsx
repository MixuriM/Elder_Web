import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Perfil from './Perfil'
import { FotoPerfilContext } from '../contexts/useFotoPerfil'

expect.extend(toHaveNoViolations)

// O contexto de foto importa useAuthUser (Firebase); o teste não precisa dele.
jest.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => ({ usuario: null, carregando: false }),
}))

// A seção de e-mail (SituacaoEmail) importa lib/auth, que inicializa o Firebase: mock, nenhum e-mail sai.
jest.mock('../lib/auth', () => ({
  emailConfirmado: jest.fn().mockResolvedValue(false),
  sendEmailVerification: jest.fn(),
  contaComSenha: () => true,
  reautenticar: jest.fn(),
  logoutUser: jest.fn(),
}))

const mockBuscarPerfil = jest.fn()
jest.mock('../services/perfilService', () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
  salvarPerfil: jest.fn(),
  enviarFotoPerfil: jest.fn(),
  removerFotoPerfil: jest.fn(),
  excluirConta: jest.fn(),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

// Foto fake (3 bytes "ABC"), só para exercitar o <img>.
const FOTO = 'data:image/jpeg;base64,QUJD'
const DADOS = { id: 1, nome: 'Ana', email: 'ana@a.com', telefone: '123', tipo_perfil: 'idoso' }

function renderPerfil(foto: string | null) {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <FotoPerfilContext.Provider
        value={{ fotoPerfilUrl: foto, carregandoFoto: false, definirFotoPerfil: () => {} }}
      >
        <Perfil />
      </FotoPerfilContext.Provider>
    </MemoryRouter>
  )
}

describe('Perfil (acessibilidade)', () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset()
    mockBuscarPerfil.mockResolvedValue(DADOS)
  })

  it('carregado, sem foto: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderPerfil(null)
    await screen.findByLabelText(/nome/i)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('carregado, com foto: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderPerfil(FOTO)
    await screen.findByRole('button', { name: /remover foto/i })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  // Exclusão de conta (2026-10-20): o diálogo aberto também não tem violação, e o foco entra nele.
  it('com a seção de exclusão e o diálogo aberto: dialog nomeado e descrito, sem violações detectáveis pelo axe', async () => {
    const user = userEvent.setup()
    const { container } = renderPerfil(null)
    await screen.findByLabelText(/nome/i)
    expect(await axe(container, AXE)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAccessibleName(/excluir minha conta/i)
    expect(dialogo).toHaveAccessibleDescription(/não dá para desfazer/i)
    expect(dialogo).toHaveFocus()
    // O diálogo fica fora do container (como no app); a regra de região é de página inteira e o jsdom não tem <main>.
    expect(await axe(document.body, { rules: { ...AXE.rules, region: { enabled: false } } })).toHaveNoViolations()
  })
})
