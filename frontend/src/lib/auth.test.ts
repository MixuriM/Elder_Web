import { SyncError, erroSemContaNoLogin, mensagemErroCadastro, mensagemErroLogin, syncUser } from './auth'

// lib/auth.ts inicializa o Firebase de verdade no import; mocks evitam isso (mesmo
// padrão de Home.test.tsx / RotaProtegida.test.tsx).
const mockGetIdToken = jest.fn().mockResolvedValue('token-fake')
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { getIdToken: (...args: unknown[]) => mockGetIdToken(...args) } })),
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
    const err = new SyncError(400, 'nome obrigatório ao criar conta.')

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

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

describe('syncUser — retry com backoff', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
  })

  it('sucesso na primeira tentativa: não espera nem repete', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { criado: false }))

    const resultado = await syncUser()

    expect(resultado).toEqual({ criado: false })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('5xx e depois sucesso: repete e espera o delay entre tentativas', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(503, { error: 'indisponível' }))
      .mockResolvedValueOnce(respostaJson(200, { criado: false }))

    const promessa = syncUser()
    await jest.advanceTimersByTimeAsync(1000) // RETRY_DELAYS_MS[0]
    const resultado = await promessa

    expect(resultado).toEqual({ criado: false })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('falha de rede (TypeError) e depois sucesso: também repete', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { criado: false }))

    const promessa = syncUser()
    await jest.advanceTimersByTimeAsync(1000)
    const resultado = await promessa

    expect(resultado).toEqual({ criado: false })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('4xx não repete: lança na primeira tentativa', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: 'tipo_perfil obrigatório' }))

    await expect(syncUser()).rejects.toMatchObject({ status: 400 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('esgota todas as tentativas em 5xx: lança o último erro', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(503, { error: 'sempre indisponível' }))

    const promessa = syncUser()
    promessa.catch(() => {})
    // 5 delays: 1000+2000+4000+8000+8000 = 23000ms
    await jest.advanceTimersByTimeAsync(23000)

    await expect(promessa).rejects.toMatchObject({ status: 503 })
    expect(global.fetch).toHaveBeenCalledTimes(6) // 1 tentativa inicial + 5 retries
  })
})

describe('mensagemErroCadastro — erros do Firebase que o usuário resolve sozinho', () => {
  it.each([
    ['auth/email-already-in-use', /já existe uma conta com este e-mail/i],
    ['auth/weak-password', /pelo menos 6 caracteres/i],
    ['auth/invalid-email', /e-mail inválido/i],
    ['auth/network-request-failed', /sem conexão/i],
    ['auth/popup-closed-by-user', /janela do google foi fechada/i],
  ])('%s: mensagem específica', (code, esperado) => {
    expect(mensagemErroCadastro(Object.assign(new Error('x'), { code }))).toMatch(esperado)
  })

  it('código desconhecido ou erro sem código: mensagem genérica', () => {
    expect(mensagemErroCadastro(Object.assign(new Error('x'), { code: 'auth/outra' }))).toMatch(/não foi possível criar a conta/i)
    expect(mensagemErroCadastro(new Error('x'))).toMatch(/não foi possível criar a conta/i)
  })
})

describe('mensagemErroLogin / erroSemContaNoLogin', () => {
  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'])(
    '%s: credencial inválida, orienta idoso cadastrado por familiar e sugere o cadastro',
    (code) => {
      const err = Object.assign(new Error('x'), { code })

      expect(mensagemErroLogin(err)).toMatch(/e-mail ou senha incorretos.*familiar cadastrou você/i)
      expect(erroSemContaNoLogin(err)).toBe(true)
    }
  )

  it.each([
    ['auth/too-many-requests', /muitas tentativas/i],
    ['auth/network-request-failed', /sem conexão/i],
    ['auth/user-disabled', /conta foi desativada/i],
    ['auth/popup-closed-by-user', /janela do google foi fechada/i],
  ])('%s: mensagem específica, sem sugerir o cadastro', (code, esperado) => {
    const err = Object.assign(new Error('x'), { code })

    expect(mensagemErroLogin(err)).toMatch(esperado)
    expect(erroSemContaNoLogin(err)).toBe(false)
  })

  it('SyncError 400 por falta de tipo_perfil: "ainda não tem uma conta" e sugere o cadastro', () => {
    const err = new SyncError(400, 'tipo_perfil obrigatório ao criar conta (idoso, cuidador ou familiar).')

    expect(mensagemErroLogin(err)).toMatch(/ainda não tem uma conta/i)
    expect(erroSemContaNoLogin(err)).toBe(true)
  })

  it('SyncError 400 de outro motivo não sugere o cadastro; erro desconhecido: mensagem genérica', () => {
    expect(erroSemContaNoLogin(new SyncError(400, 'nome obrigatório ao criar conta.'))).toBe(false)
    expect(mensagemErroLogin(new Error('x'))).toMatch(/não foi possível entrar/i)
  })
})
