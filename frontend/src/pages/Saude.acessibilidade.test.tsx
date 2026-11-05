import '@testing-library/jest-dom'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar, listaPerfilIdoso } from '../hooks/idososFixtures'

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
  global.fetch = jest.fn()
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

  it('não mostra edição antes ou depois da consulta do histórico', async () => {
    fetchMock().mockResolvedValue(respostaJson(200, { registros: [] }))
    const user = userEvent.setup()
    renderizarSaude()

    const verificarSemEdicao = () => {
      expect(screen.queryByText(/editar meu registro/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/editar registro do idoso/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/ID do registro/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /salvar alterações/i })).not.toBeInTheDocument()
    }

    verificarSemEdicao()
    await user.click(pegarSecao(/histórico de saúde/i).getByRole('button', { name: /ver histórico/i }))
    expect(await screen.findByText(/nenhum registro encontrado/i)).toBeInTheDocument()
    verificarSemEdicao()
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

  it('possui botão de consulta com nome acessível', () => {
    renderizarSaude()
    expect(
      pegarSecao(/histórico de saúde/i).getByRole('button', { name: /^ver histórico$/i }),
    ).toBeInTheDocument()
  })

  it('informa quando o histórico está vazio', async () => {
    fetchMock().mockResolvedValue(respostaJson(200, { registros: [] }))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    await user.click(secao.getByRole('button', { name: /^ver histórico$/i }))
    expect(await secao.findByText(/nenhum registro encontrado/i)).toBeInTheDocument()
  })

  it('exibe erros de consulta com role alert', async () => {
    fetchMock().mockResolvedValue(respostaJson(400, { error: 'Erro ao carregar histórico.' }))
    const user = userEvent.setup()
    renderizarSaude()
    const secao = pegarSecao(/histórico de saúde/i)

    await user.click(secao.getByRole('button', { name: /^ver histórico$/i }))
    expect(await secao.findByRole('alert')).toHaveTextContent('Erro ao carregar histórico.')
  })
})

describe('Saude — acessibilidade das permissões', () => {
  beforeEach(() => configurarFamiliar())

  it('mostra aviso de falta de permissão com role status', () => {
    configurarFamiliar(false)
    renderizarSaude()

    expect(screen.getByRole('status')).toHaveTextContent(/não possui permissão/i)
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
