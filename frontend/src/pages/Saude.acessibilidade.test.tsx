import '@testing-library/jest-dom'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar, listaPerfilIdoso } from '../hooks/idososFixtures'

expect.extend(toHaveNoViolations)

// O jsdom não calcula contraste: o contraste é auditado por npm run test:a11y (Playwright). Dados obviamente falsos.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

const mockGetCurrentUserToken = jest.fn()
const mockUseIdosos = jest.fn()
const mockUseAcesso = jest.fn()

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}))

jest.mock('../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => mockUseIdosos(),
}))

jest.mock('../contexts/useAcesso', () => ({
  useAcesso: () => mockUseAcesso(),
}))

jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: jest.fn(),
}))

const mockUsePermissoes = permissoesSaude.usePermissoesSaude as jest.Mock

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

function fetchMock(): jest.Mock {
  return global.fetch as jest.Mock
}

const REGISTRO = { id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' }

// GET devolve os registros dados; escrita devolve a resposta dada.
function simularApi(registros: unknown[] = [], escrita: Response = respostaJson(201, { id: 55 })) {
  fetchMock().mockImplementation((_url: string, opcoes?: RequestInit) =>
    Promise.resolve((opcoes?.method ?? 'GET') === 'GET' ? respostaJson(200, { registros }) : escrita),
  )
}

function renderizarSaude() {
  return render(
    <MemoryRouter>
      <Saude />
    </MemoryRouter>,
  )
}

function pegarSecao(nome: RegExp) {
  const titulo = screen.getByRole('heading', { name: nome })
  const section = titulo.closest('section')
  if (!section) throw new Error(`Seção não encontrada: ${nome}`)
  return within(section)
}

const botaoDoCabecalho = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Registrar leitura' })

function configurarFamiliar(escrita = true) {
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
  mockUseIdosos.mockReturnValue(listaFamiliar)
  mockUsePermissoes.mockReturnValue({
    estado: 'ok',
    escrita,
    avisoSemFlag: !escrita,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'idoso' })
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  mockGetCurrentUserToken.mockResolvedValue('token-fake')
  mockUsePermissoes.mockReturnValue({
    estado: 'ok',
    escrita: false,
    avisoSemFlag: false,
  })
  global.fetch = jest.fn()
  simularApi()
})

describe('Saude — estrutura acessível', () => {
  it('idoso: título, botão de registrar com nome acessível e histórico', async () => {
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /minha saúde/i })).toBeInTheDocument()
    expect(botaoDoCabecalho()).toBeEnabled()
    expect(screen.getByRole('heading', { name: /histórico de saúde/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /registrar saúde do idoso/i })).not.toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('familiar autorizado: título do idoso e botão de registrar', async () => {
    configurarFamiliar()
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /saúde do idoso/i })).toBeInTheDocument()
    expect(botaoDoCabecalho()).toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('a página inteira, com a lista carregada, não tem violações', async () => {
    simularApi([REGISTRO])
    const { container } = renderizarSaude()
    await screen.findByText('pressao')

    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('Editar e Remover do idoso aparecem depois que a lista carrega, sem botão "Ver histórico"', async () => {
    simularApi([REGISTRO])
    renderizarSaude()

    expect(await screen.findByRole('button', { name: 'Editar registro de pressao' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover registro de pressao' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
  })
})

describe('Saude — acessibilidade do modal de registrar (idoso)', () => {
  async function abrir() {
    const user = userEvent.setup()
    const utils = renderizarSaude()
    await screen.findByText('Nenhum registro de saúde')
    await user.click(botaoDoCabecalho())
    return { user, ...utils, dialogo: screen.getByRole('dialog', { name: 'Registrar leitura de saúde' }) }
  }

  it('dialog modal, foco dentro, campos associados aos rótulos e sem violações', async () => {
    const { dialogo } = await abrir()

    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveFocus()
    for (const rotulo of ['Tipo de medição', 'Valor 1', 'Valor 2 (opcional)', 'Unidade', 'Data e hora (opcional)', 'Observações (opcional)']) {
      expect(within(dialogo).getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
    expect(within(dialogo).getByRole('button', { name: 'Salvar leitura' })).toBeInTheDocument()
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })

  it('exibe erros com role alert dentro do modal', async () => {
    simularApi([], respostaJson(400, { error: 'valor_1 inválido.' }))
    const { user, dialogo } = await abrir()

    await user.type(within(dialogo).getByLabelText('Tipo de medição'), 'peso')
    await user.type(within(dialogo).getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(within(dialogo).getByLabelText('Unidade'), 'kg')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar leitura' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('valor_1 inválido.')
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })

  it('exibe confirmação em role status depois de registrar, e o foco volta ao botão', async () => {
    const { user, dialogo } = await abrir()

    await user.type(within(dialogo).getByLabelText('Tipo de medição'), 'peso')
    await user.type(within(dialogo).getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(within(dialogo).getByLabelText('Unidade'), 'kg')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar leitura' }))

    expect((await screen.findByText('Leitura registrada com sucesso.')).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(botaoDoCabecalho()).toHaveFocus()
  })

  it('desabilita o botão durante o envio', async () => {
    fetchMock().mockImplementation((_url: string, opcoes?: RequestInit) =>
      (opcoes?.method ?? 'GET') === 'GET' ? Promise.resolve(respostaJson(200, { registros: [] })) : new Promise(() => undefined),
    )
    const { user, dialogo } = await abrir()

    await user.type(within(dialogo).getByLabelText('Tipo de medição'), 'peso')
    await user.type(within(dialogo).getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(within(dialogo).getByLabelText('Unidade'), 'kg')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar leitura' }))

    expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()
  })
})

describe('Saude — acessibilidade do modal de registrar (terceiro)', () => {
  beforeEach(() => configurarFamiliar())

  it('seletor de idoso rotulado dentro do modal, campos associados e sem violações', async () => {
    const user = userEvent.setup()
    renderizarSaude()
    await screen.findByText('Nenhum registro de saúde')
    await user.click(botaoDoCabecalho())
    const dialogo = screen.getByRole('dialog', { name: 'Registrar leitura de saúde' })

    const seletor = within(dialogo).getByLabelText('Idoso')
    expect(seletor.tagName).toBe('SELECT')
    for (const rotulo of ['Tipo de medição', 'Valor 1', 'Unidade']) {
      expect(within(dialogo).getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })
})

describe('Saude — acessibilidade do histórico', () => {
  beforeEach(() => configurarFamiliar())

  it('possui seletor com rótulo e nome do idoso', async () => {
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)
    const seletor = secao.getByLabelText('Idoso')

    expect(seletor.tagName).toBe('SELECT')
    expect(within(seletor).getAllByRole('option')[0]).toHaveTextContent('Idoso Teste Cinco (c***@teste.com)')
    await screen.findByText('Nenhum registro de saúde')
  })

  it('informa o carregamento com role status, sem botão de consulta', async () => {
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    expect(secao.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(secao.getByRole('status')).toHaveTextContent(/carregando o histórico de saúde/i)
    await screen.findByText('Nenhum registro de saúde')
  })

  it('lista vazia: cartão com ícone, título e texto, anunciado em role status', async () => {
    const { container } = renderizarSaude()

    const titulo = await screen.findByText('Nenhum registro de saúde')
    expect(titulo.closest('[role="status"]')).not.toBeNull()
    expect(screen.getByText(/registre a primeira medição/i)).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('exibe erro de carga com role alert e mensagem fixa, sem ecoar o servidor', async () => {
    fetchMock().mockResolvedValue(respostaJson(400, { error: 'TEXTO DO SERVIDOR' }))
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    const alerta = await secao.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar o histórico de saúde.')
    expect(alerta).not.toHaveTextContent('TEXTO DO SERVIDOR')
  })
})

describe('Saude — acessibilidade das permissões', () => {
  beforeEach(() => configurarFamiliar())

  it('mostra aviso de falta de permissão com role status', async () => {
    configurarFamiliar(false)
    renderizarSaude()

    expect(screen.getByText(/não possui permissão/i).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar leitura' })).not.toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('exibe erro de permissões com role alert', async () => {
    mockUsePermissoes.mockReturnValue({
      estado: 'erro',
      escrita: false,
      avisoSemFlag: false,
    })
    renderizarSaude()

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível verificar suas permissões/i)
    await screen.findByText('Nenhum registro de saúde')
  })
})

describe('Saude — acessibilidade do carregamento', () => {
  it('informa que as permissões estão carregando', () => {
    mockUsePermissoes.mockReturnValue({
      estado: 'carregando',
      escrita: false,
      avisoSemFlag: false,
    })
    renderizarSaude()

    expect(screen.getByText(/carregando informações de saúde/i)).toBeInTheDocument()
  })
})

describe('Saude — acessibilidade dos modais de editar e remover', () => {
  async function comRegistro() {
    simularApi([REGISTRO])
    renderizarSaude()
    await screen.findByText('pressao')
  }

  it('edição: dialog modal nomeado, foco dentro, campos rotulados e sem violações', async () => {
    const user = userEvent.setup()
    await comRegistro()

    await user.click(screen.getByRole('button', { name: 'Editar registro de pressao' }))

    const dialogo = screen.getByRole('dialog', { name: 'Editar registro' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveFocus()
    for (const rotulo of ['Tipo de medição', 'Valor 1', 'Valor 2 (opcional)', 'Unidade', 'Data e hora', 'Observações (opcional)']) {
      expect(within(dialogo).getByLabelText(rotulo)).toBeInTheDocument()
    }
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })

  it('remoção: alertdialog com texto claro, botões com texto e sem violações', async () => {
    const user = userEvent.setup()
    await comRegistro()

    await user.click(screen.getByRole('button', { name: 'Remover registro de pressao' }))

    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveFocus()
    expect(within(dialogo).getByText('Remover este registro? Esta ação não pode ser desfeita.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Remover' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })
})
