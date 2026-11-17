import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar, listaPerfilIdoso, listaSemIdosos } from '../hooks/idososFixtures'

jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: jest.fn(),
}))

const mockUsePermissoes = permissoesSaude.usePermissoesSaude as jest.Mock
const mockUseIdosos = jest.fn()
const mockUseAcesso = jest.fn()
const mockGetCurrentUserToken = jest.fn()
const fetchMock = jest.fn()

jest.mock('../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => mockUseIdosos(),
}))

jest.mock('../contexts/useAcesso', () => ({
  useAcesso: () => mockUseAcesso(),
}))

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}))

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

function renderizarSaude() {
  return render(
    <MemoryRouter>
      <Saude />
    </MemoryRouter>,
  )
}

// A lista carrega sozinha ao abrir a tela: GET devolve os registros dados; escrita devolve a resposta dada.
function simularApi(escrita: Response = respostaJson(200, {}), registros: unknown[] = []) {
  fetchMock.mockImplementation((_url: string, opcoes: RequestInit = {}) =>
    Promise.resolve((opcoes.method ?? 'GET') === 'GET' ? respostaJson(200, { registros }) : escrita),
  )
}

function chamada(metodo: string) {
  const achada = fetchMock.mock.calls.find(([, o]) => (o?.method ?? 'GET') === metodo)
  if (!achada) throw new Error(`Nenhuma chamada ${metodo}`)
  return achada as [string, RequestInit & { headers: Record<string, string>; body: string }]
}

function secaoPeloTitulo(nome: RegExp) {
  const titulo = screen.getByRole('heading', { name: nome })
  const elemento = titulo.closest('section')
  if (!elemento) throw new Error(`Seção não encontrada: ${nome}`)
  return within(elemento)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'idoso' })
  mockUsePermissoes.mockReturnValue({
    estado: 'ok',
    escrita: false,
    avisoSemFlag: false,
  })
  mockGetCurrentUserToken.mockResolvedValue('token-fake')
  fetchMock.mockReset()
  simularApi()
  global.fetch = fetchMock
})

describe('Saude — estrutura da página', () => {
  it('mostra título, descrição, cadastro próprio e histórico para o idoso', () => {
    renderizarSaude()
    expect(screen.getByRole('heading', { level: 1, name: /minha saúde/i })).toBeInTheDocument()
    expect(screen.getByText(/registre, acompanhe e mantenha suas informações/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /registrar leitura de saúde/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /histórico de saúde/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /registrar saúde do idoso/i })).not.toBeInTheDocument()
  })

  it('mostra título e cadastro do idoso vinculado para familiar autorizado', () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    renderizarSaude()
    expect(screen.getByRole('heading', { level: 1, name: /saúde do idoso/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /registrar saúde do idoso/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /registrar leitura de saúde/i })).not.toBeInTheDocument()
  })

  it('o histórico carrega sozinho, sem botão "Ver histórico", e o idoso vê Editar e Remover', async () => {
    simularApi(respostaJson(200, {}), [
      { id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' },
    ])
    renderizarSaude()

    expect(await screen.findByText('pressao')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar registro de pressao' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover registro de pressao' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar alterações/i })).not.toBeInTheDocument()
  })

  it('depois de registrar a leitura própria, a lista recarrega sozinha', async () => {
    simularApi(respostaJson(201, { id: 55 }))
    const user = userEvent.setup()
    renderizarSaude()
    await screen.findByText(/nenhum registro encontrado/i)
    const s = secaoPeloTitulo(/registrar leitura de saúde/i)

    await user.type(s.getByLabelText('Tipo de medição'), 'peso')
    await user.type(s.getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(s.getByLabelText('Unidade'), 'kg')
    await user.click(s.getByRole('button', { name: /^registrar leitura$/i }))
    await screen.findByText(/leitura registrada com sucesso/i)

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, o]) => (o?.method ?? 'GET') === 'GET')).toHaveLength(2),
    )
  })
})

describe('Saude — registrar minha saúde', () => {
  it('exibe campos acessíveis por rótulo', () => {
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar leitura de saúde/i)
    for (const rotulo of ['Tipo de medição', 'Valor 1', 'Valor 2 (opcional)', 'Unidade', 'Data e hora (opcional)', 'Observações (opcional)']) {
      expect(s.getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
  })

  it('envia POST /saude com números, data e autenticação', async () => {
    simularApi(respostaJson(201, { id: 55 }))
    const user = userEvent.setup()
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar leitura de saúde/i)

    await user.type(s.getByLabelText('Tipo de medição'), 'pressao')
    await user.type(s.getByLabelText('Valor 1', { exact: true }), '120')
    await user.type(s.getByLabelText('Valor 2 (opcional)'), '80')
    await user.type(s.getByLabelText('Unidade'), 'mmHg')
    fireEvent.change(s.getByLabelText('Data e hora (opcional)'), {
      target: { value: '2026-09-23T10:00' },
    })
    await user.click(s.getByRole('button', { name: /^registrar leitura$/i }))

    await screen.findByText(/leitura registrada com sucesso/i)
    const [url, opcoes] = chamada('POST')
    const corpo = JSON.parse(opcoes.body)
    expect(url).toMatch(/\/saude$/)
    expect(opcoes.method).toBe('POST')
    expect(opcoes.headers.Authorization).toBe('Bearer token-fake')
    expect(corpo).toMatchObject({
      tipo_medicao: 'pressao',
      valor_1: 120,
      valor_2: 80,
      unidade: 'mmHg',
      data_hora: new Date('2026-09-23T10:00').toISOString(),
    })
    expect(corpo).not.toHaveProperty('idoso_id')
    expect(corpo).not.toHaveProperty('registrado_por_id')
    expect(corpo).not.toHaveProperty('editado_por_id')
    expect(await screen.findByText(/leitura registrada com sucesso/i)).toBeInTheDocument()
  })

  it('mostra mensagem de erro retornada pela API', async () => {
    simularApi(respostaJson(400, { error: 'valor_1 inválido.' }))
    const user = userEvent.setup()
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar leitura de saúde/i)
    await user.type(s.getByLabelText('Tipo de medição'), 'peso')
    await user.type(s.getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(s.getByLabelText('Unidade'), 'kg')
    await user.click(s.getByRole('button', { name: /^registrar leitura$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('valor_1 inválido.')
  })
})

describe('Saude — registrar saúde do idoso', () => {
  beforeEach(() => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
  })

  it('mostra campos do idoso vinculado', () => {
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar saúde do idoso/i)
    for (const rotulo of ['Idoso', 'Tipo de medição', 'Valor 1', 'Unidade']) {
      expect(s.getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
  })

  it('envia POST /saude/idoso/:id', async () => {
    simularApi(respostaJson(201, { id: 77 }))
    const user = userEvent.setup()
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar saúde do idoso/i)
    await user.selectOptions(s.getByLabelText('Idoso'), '5')
    await user.type(s.getByLabelText('Tipo de medição'), 'glicemia')
    await user.type(s.getByLabelText('Valor 1', { exact: true }), '95')
    await user.type(s.getByLabelText('Unidade'), 'mg/dL')
    await user.click(s.getByRole('button', { name: /registrar leitura do idoso/i }))
    await screen.findByText(/leitura registrada com sucesso/i)
    const [url, opcoes] = chamada('POST')
    expect(url).toMatch(/\/saude\/idoso\/5$/)
    expect(JSON.parse(opcoes.body)).toMatchObject({ valor_1: 95 })
    expect(JSON.parse(opcoes.body)).not.toHaveProperty('idoso_id')
  })
})

describe('Saude — histórico', () => {
  const REGISTRO = { id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' }

  it('idoso: GET /saude ao abrir, sem seletor e sem botão', async () => {
    simularApi(respostaJson(200, {}), [REGISTRO])
    renderizarSaude()
    const s = secaoPeloTitulo(/histórico de saúde/i)

    expect(s.queryByRole('combobox')).not.toBeInTheDocument()
    expect(await s.findByText('pressao')).toBeInTheDocument()
    const [url, opcoes] = chamada('GET')
    expect(url).toMatch(/\/saude$/)
    expect(opcoes.method).toBe('GET')
  })

  it('familiar: pré-seleciona o primeiro idoso e já carrega GET /saude/idoso/:id', async () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    simularApi(respostaJson(200, {}), [REGISTRO])
    renderizarSaude()
    const s = secaoPeloTitulo(/histórico de saúde/i)

    expect(s.getByLabelText('Idoso')).toHaveValue('5')
    expect(s.queryByLabelText(/ID do idoso/i)).not.toBeInTheDocument()
    expect(await s.findByText('pressao')).toBeInTheDocument()
    expect(chamada('GET')[0]).toMatch(/\/saude\/idoso\/5$/)
  })

  it('familiar: trocar o idoso recarrega pelo caminho do novo idoso', async () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    const user = userEvent.setup()
    renderizarSaude()
    const s = secaoPeloTitulo(/histórico de saúde/i)
    await s.findByText(/nenhum registro encontrado/i)

    await user.selectOptions(s.getByLabelText('Idoso'), '8')

    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([url]) => String(url)).some((u) => /\/saude\/idoso\/8$/.test(u))).toBe(true),
    )
  })

  it('sem idosos vinculados não consulta a API', () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaSemIdosos)
    renderizarSaude()

    expect(fetchMock.mock.calls.filter(([url]) => /\/saude/.test(String(url)))).toHaveLength(0)
  })
})

describe('Saude — permissões', () => {
  beforeEach(() => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
  })

  it('sem permissão oculta o cadastro do idoso e exibe aviso', () => {
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: false, avisoSemFlag: true })
    renderizarSaude()
    expect(screen.queryByRole('heading', { name: /registrar saúde do idoso/i })).not.toBeInTheDocument()
    expect(screen.getByText(/não possui permissão/i).closest('[role="status"]')).not.toBeNull()
  })

  it('com permissão mostra cadastro do idoso', () => {
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    renderizarSaude()
    expect(screen.getByRole('heading', { name: /registrar saúde do idoso/i })).toBeInTheDocument()
  })

  it('erro de permissão mantém comportamento atual e mostra alerta', () => {
    mockUsePermissoes.mockReturnValue({ estado: 'erro', escrita: false, avisoSemFlag: false })
    renderizarSaude()
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível verificar suas permissões/i)
    expect(screen.getByRole('heading', { name: /registrar saúde do idoso/i })).toBeInTheDocument()
  })

  it('mostra carregamento enquanto consulta permissões', () => {
    mockUsePermissoes.mockReturnValue({ estado: 'carregando', escrita: false, avisoSemFlag: false })
    renderizarSaude()
    expect(screen.getByText(/carregando informações de saúde/i)).toBeInTheDocument()
  })
})

describe('Saude — privacidade', () => {
  it('não imprime valores clínicos no console quando o cadastro falha', async () => {
    simularApi(respostaJson(400, { error: 'valor inválido' }))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const user = userEvent.setup()
      renderizarSaude()
      const s = secaoPeloTitulo(/registrar leitura de saúde/i)
      await user.type(s.getByLabelText('Tipo de medição'), 'pressao')
      await user.type(s.getByLabelText('Valor 1', { exact: true }), '123.45')
      await user.type(s.getByLabelText('Unidade'), 'mmHg')
      await user.type(s.getByLabelText('Observações (opcional)'), 'segredo-clinico')
      await user.click(s.getByRole('button', { name: /^registrar leitura$/i }))
      await screen.findByRole('alert')
      const logado = JSON.stringify(spy.mock.calls)
      expect(logado).not.toContain('123.45')
      expect(logado).not.toContain('segredo-clinico')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('Saude — seletor de idoso', () => {
  it('com múltiplos idosos, exige seleção antes do cadastro', async () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    const user = userEvent.setup()
    renderizarSaude()
    const s = secaoPeloTitulo(/registrar saúde do idoso/i)
    const seletor = s.getByLabelText('Idoso')
    const botao = s.getByRole('button', { name: /registrar leitura do idoso/i })
    expect(seletor).toHaveValue('')
    expect(s.getByRole('option', { name: 'Selecione o idoso' })).toBeInTheDocument()
    expect(botao).toBeDisabled()
    await user.selectOptions(seletor, '8')
    expect(botao).toBeEnabled()
  })
})
