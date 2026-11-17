import '@testing-library/jest-dom'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar, listaPerfilIdoso } from '../hooks/idososFixtures'

expect.extend(toHaveNoViolations)

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
  global.fetch = jest.fn(() => Promise.resolve(respostaJson(200, { registros: [] })))
})

describe('Saude — estrutura acessível', () => {
  it('mostra o título e as seções próprias para o perfil idoso', () => {
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /minha saúde/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /registrar leitura de saúde/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /histórico de saúde/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /registrar saúde do idoso/i })).not.toBeInTheDocument()
  })

  it('mostra as seções adequadas para familiar autorizado', () => {
    configurarFamiliar()
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /saúde do idoso/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /registrar saúde do idoso/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /histórico de saúde/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /registrar leitura de saúde/i })).not.toBeInTheDocument()
  })

  it('mostra Editar e Remover do idoso depois que a lista carrega, sem botão "Ver histórico"', async () => {
    fetchMock().mockResolvedValue(
      respostaJson(200, {
        registros: [{ id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' }],
      }),
    )
    renderizarSaude()

    expect(await screen.findByRole('button', { name: 'Editar registro de pressao' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover registro de pressao' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
  })
})

describe('Saude — acessibilidade do registro próprio', () => {
  it('associa todos os campos aos seus rótulos', () => {
    renderizarSaude()
    const secao = pegarSecao(/registrar leitura de saúde/i)

    for (const rotulo of [
      'Tipo de medição',
      'Valor 1',
      'Valor 2 (opcional)',
      'Unidade',
      'Data e hora (opcional)',
      'Observações (opcional)',
    ]) {
      expect(secao.getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
  })

  it('possui botão de envio com nome acessível', () => {
    renderizarSaude()
    expect(
      pegarSecao(/registrar leitura de saúde/i).getByRole('button', {
        name: /^registrar leitura$/i,
      }),
    ).toBeInTheDocument()
  })

  it('exibe erros com role alert', async () => {
    fetchMock().mockResolvedValue(respostaJson(400, { error: 'Mensagem de erro de teste.' }))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/registrar leitura de saúde/i)

    await user.type(secao.getByLabelText('Tipo de medição'), 'peso')
    await user.type(secao.getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(secao.getByLabelText('Unidade'), 'kg')
    await user.click(secao.getByRole('button', { name: /^registrar leitura$/i }))

    expect(await secao.findByRole('alert')).toHaveTextContent('Mensagem de erro de teste.')
  })

  it('exibe confirmação após cadastro', async () => {
    fetchMock().mockResolvedValue(respostaJson(201, { id: 11 }))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/registrar leitura de saúde/i)

    await user.type(secao.getByLabelText('Tipo de medição'), 'peso')
    await user.type(secao.getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(secao.getByLabelText('Unidade'), 'kg')
    await user.click(secao.getByRole('button', { name: /^registrar leitura$/i }))

    expect(await secao.findByText(/leitura registrada com sucesso/i)).toBeInTheDocument()
  })
})

describe('Saude — acessibilidade do registro de idoso vinculado', () => {
  beforeEach(() => configurarFamiliar())

  it('associa todos os campos aos seus rótulos', () => {
    renderizarSaude()
    const secao = pegarSecao(/registrar saúde do idoso/i)

    for (const rotulo of [
      'Idoso',
      'Tipo de medição',
      'Valor 1',
      'Valor 2 (opcional)',
      'Unidade',
      'Data e hora (opcional)',
      'Observações (opcional)',
    ]) {
      expect(secao.getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
  })

  it('possui botão com nome acessível', () => {
    renderizarSaude()
    expect(
      pegarSecao(/registrar saúde do idoso/i).getByRole('button', {
        name: /registrar leitura do idoso/i,
      }),
    ).toBeInTheDocument()
  })

  it('exibe erros com role alert', async () => {
    fetchMock().mockResolvedValue(respostaJson(400, { error: 'Mensagem de erro de teste.' }))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/registrar saúde do idoso/i)

    await user.selectOptions(secao.getByLabelText('Idoso'), '5')
    await user.type(secao.getByLabelText('Tipo de medição'), 'glicemia')
    await user.type(secao.getByLabelText('Valor 1', { exact: true }), '95')
    await user.type(secao.getByLabelText('Unidade'), 'mg/dL')
    await user.click(secao.getByRole('button', { name: /registrar leitura do idoso/i }))

    expect(await secao.findByRole('alert')).toHaveTextContent('Mensagem de erro de teste.')
  })
})

describe('Saude — acessibilidade do histórico', () => {
  beforeEach(() => configurarFamiliar())

  it('possui seletor com rótulo e nome do idoso', () => {
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)
    const seletor = secao.getByLabelText('Idoso')

    expect(seletor.tagName).toBe('SELECT')
    expect(within(seletor).getAllByRole('option')[0]).toHaveTextContent(
      'Idoso Teste Cinco (c***@teste.com)',
    )
  })

  it('informa o carregamento com role status, sem botão de consulta', async () => {
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    expect(secao.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(secao.getByRole('status')).toHaveTextContent(/carregando o histórico de saúde/i)
    await screen.findByText(/nenhum registro encontrado/i)
  })

  it('informa quando o histórico está vazio, com role status', async () => {
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    expect(await secao.findByText(/nenhum registro encontrado/i)).toBeInTheDocument()
    expect(secao.getByText(/nenhum registro encontrado/i).closest('[role="status"]')).not.toBeNull()
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

  it('mostra aviso de falta de permissão com role status', () => {
    configurarFamiliar(false)
    renderizarSaude()

    expect(screen.getByText(/não possui permissão/i).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: /registrar saúde do idoso/i })).not.toBeInTheDocument()
  })

  it('exibe erro de permissões com role alert', () => {
    mockUsePermissoes.mockReturnValue({
      estado: 'erro',
      escrita: false,
      avisoSemFlag: false,
    })
    renderizarSaude()

    expect(screen.getByRole('alert')).toHaveTextContent(
      /não foi possível verificar suas permissões/i,
    )
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

  it('desabilita o botão durante o envio', async () => {
    fetchMock().mockReturnValue(new Promise<Response>(() => undefined))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/registrar leitura de saúde/i)

    await user.type(secao.getByLabelText('Tipo de medição'), 'peso')
    await user.type(secao.getByLabelText('Valor 1', { exact: true }), '70')
    await user.type(secao.getByLabelText('Unidade'), 'kg')
    await user.click(secao.getByRole('button', { name: /^registrar leitura$/i }))

    expect(
      await secao.findByRole('button', { name: /registrando/i }),
    ).toBeDisabled()
  })
})

// O jsdom não calcula contraste: o contraste é auditado por npm run test:a11y (Playwright).
const AXE = { rules: { 'color-contrast': { enabled: false } } }

describe('Saude — acessibilidade dos modais de editar e remover', () => {
  async function comRegistro() {
    fetchMock().mockResolvedValue(
      respostaJson(200, {
        registros: [{ id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' }],
      }),
    )
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
