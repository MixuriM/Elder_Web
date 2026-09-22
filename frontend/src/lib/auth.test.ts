import { SyncError, mensagemErroCadastro, mensagemErroLogin, syncUser } from './auth'

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
