import { SyncError, mensagemErroCadastro, mensagemErroLogin } from './auth'

// lib/auth.ts inicializa o Firebase de verdade no import; mocks evitam isso (mesmo
// padrão de Home.test.tsx / RotaProtegida.test.tsx).
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
}))
jest.mock('./firebase', () => ({ app: {} }))

describe('mensagens de erro de /auth/sync (item 3.2)', () => {
  it('409 com codigo e proximoPasso: mostra error + proximo_passo, não "servidor iniciando"', () => {
    const err = new SyncError(409, 'Este e-mail já está em uso.', 'EMAIL_JA_EM_USO', 'Use outro e-mail para se cadastrar.')

    for (const msg of [mensagemErroCadastro(err), mensagemErroLogin(err)]) {
      expect(msg).toBe('Este e-mail já está em uso. Use outro e-mail para se cadastrar.')
      expect(msg).not.toMatch(/servidor está iniciando/)
    }
  })

  it('5xx: mantém a mensagem de "servidor iniciando"', () => {
    const err = new SyncError(500, 'Falha em /auth/sync: status 500')

    expect(mensagemErroCadastro(err)).toMatch(/servidor está iniciando/)
    expect(mensagemErroLogin(err)).toMatch(/servidor está iniciando/)
  })

  it('4xx sem codigo: mensagem genérica de sync, sem culpar o servidor', () => {
    const err = new SyncError(400, 'tipo_perfil obrigatório ao criar conta (idoso, cuidador ou familiar).')

    for (const msg of [mensagemErroCadastro(err), mensagemErroLogin(err)]) {
      expect(msg).toMatch(/Falha ao sincronizar/)
      expect(msg).not.toMatch(/servidor está iniciando/)
    }
  })

  it('erro que não é SyncError segue nas mensagens de credencial/cadastro de antes', () => {
    expect(mensagemErroLogin(new Error('auth/wrong-password'))).toMatch(/e-mail e senha/)
    expect(mensagemErroCadastro(new Error('auth/email-already-in-use'))).toMatch(/criar a conta/)
  })
})
