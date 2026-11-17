import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar, listaPerfilIdoso, listaSemIdosos } from '../hooks/idososFixtures'

// O formulário de registrar tem teste próprio (components/Saude/ModalRegistrarSaude.test.tsx) e a lista também
// (HistoricoSaude.test.tsx). Aqui, o que a página junta: só o histórico na tela, o botão que abre o modal, quem o vê, e a
// lista que recarrega sozinha depois de registrar. Valores obviamente falsos.

jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: jest.fn(),
}))

const mockUsePermissoes = permissoesSaude.usePermissoesSaude as jest.Mock
const mockUseIdosos = jest.fn()
const mockUseAcesso = jest.fn()
const fetchMock = jest.fn()

jest.mock('../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => mockUseIdosos(),
}))

jest.mock('../contexts/useAcesso', () => ({
  useAcesso: () => mockUseAcesso(),
}))

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: () => Promise.resolve('token-fake'),
}))

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

const REGISTRO = { id: 7, tipo_medicao: 'pressao', valor_1: 120, valor_2: 80, unidade: 'mmHg', data_hora: '2026-09-24T12:00:00.000Z' }

let registros: unknown[]

function metodoDe(opcoes?: RequestInit) {
  return opcoes?.method ?? 'GET'
}

function gets() {
  return fetchMock.mock.calls.filter(([, o]) => metodoDe(o) === 'GET')
}

function renderizarSaude() {
  return render(
    <MemoryRouter>
      <Saude />
    </MemoryRouter>,
  )
}

// A página tem dois botões com o mesmo nome (o do cabeçalho e o do cartão de lista vazia, como em Medicamentos): este é o do cabeçalho.
const botaoDoCabecalho = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Registrar leitura' })

async function registrarLeitura(user: ReturnType<typeof userEvent.setup>) {
  await user.click(botaoDoCabecalho())
  const dialogo = screen.getByRole('dialog', { name: 'Registrar leitura de saúde' })
  await user.type(within(dialogo).getByLabelText('Tipo de medição'), 'peso')
  await user.type(within(dialogo).getByLabelText('Valor 1', { exact: true }), '70')
  await user.type(within(dialogo).getByLabelText('Unidade'), 'kg')
  await user.click(within(dialogo).getByRole('button', { name: 'Salvar leitura' }))
}

beforeEach(() => {
  jest.clearAllMocks()
  registros = []
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'idoso' })
  mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: false, avisoSemFlag: false })
  fetchMock.mockReset()
  fetchMock.mockImplementation((_url: string, opcoes?: RequestInit) =>
    Promise.resolve(metodoDe(opcoes) === 'GET' ? respostaJson(200, { registros }) : respostaJson(201, { id: 55 })),
  )
  global.fetch = fetchMock
})

describe('Saude — estrutura da página', () => {
  it('idoso: título, descrição, botão de registrar e histórico; o formulário não fica na tela', async () => {
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /minha saúde/i })).toBeInTheDocument()
    expect(screen.getByText(/registre, acompanhe e mantenha suas informações/i)).toBeInTheDocument()
    expect(botaoDoCabecalho()).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /histórico de saúde/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Tipo de medição')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await screen.findByText(/nenhum registro de saúde/i)
  })

  it('familiar autorizado: título do idoso e botão de registrar', async () => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    renderizarSaude()

    expect(screen.getByRole('heading', { level: 1, name: /saúde do idoso/i })).toBeInTheDocument()
    expect(botaoDoCabecalho()).toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('não existe mais o botão "Ver histórico": a lista carrega sozinha', async () => {
    registros = [REGISTRO]
    renderizarSaude()

    expect(await screen.findByText('pressao')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar registro de pressao' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover registro de pressao' })).toBeInTheDocument()
  })

  it('o registro não mostra o número de identificação (#id)', async () => {
    registros = [REGISTRO]
    renderizarSaude()

    await screen.findByText('pressao')
    expect(screen.queryByText('#7')).not.toBeInTheDocument()
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument()
  })
})

describe('Saude — registrar por modal', () => {
  it('o botão abre o modal sobreposto; Cancelar fecha sem enviar', async () => {
    const user = userEvent.setup()
    renderizarSaude()
    await screen.findByText(/nenhum registro de saúde/i)

    await user.click(botaoDoCabecalho())
    expect(screen.getByRole('dialog', { name: 'Registrar leitura de saúde' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, o]) => metodoDe(o) === 'POST')).toHaveLength(0)
  })

  it('o botão do cartão de lista vazia abre o mesmo modal', async () => {
    const user = userEvent.setup()
    renderizarSaude()
    const vazio = (await screen.findByText('Nenhum registro de saúde')).closest('section') as HTMLElement
    expect(vazio).toHaveTextContent('Nenhum registro de saúde')

    await user.click(within(vazio).getByRole('button', { name: 'Registrar leitura' }))

    expect(screen.getByRole('dialog', { name: 'Registrar leitura de saúde' })).toBeInTheDocument()
  })

  it('depois de registrar: o modal fecha, a página avisa em role=status e a lista recarrega sozinha', async () => {
    const user = userEvent.setup()
    renderizarSaude()
    await screen.findByText(/nenhum registro de saúde/i)
    expect(gets()).toHaveLength(1)

    registros = [{ ...REGISTRO, tipo_medicao: 'peso', id: 8 }]
    await registrarLeitura(user)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Leitura registrada com sucesso.').closest('[role="status"]')).not.toBeNull()
    expect(await screen.findByText('peso')).toBeInTheDocument()
    expect(gets()).toHaveLength(2)
  })

  it('erro ao registrar mantém o modal aberto e não recarrega a lista', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(metodoDe(opcoes) === 'GET' ? respostaJson(200, { registros }) : respostaJson(400, { error: 'valor_1 inválido.' })),
    )
    renderizarSaude()
    await screen.findByText(/nenhum registro de saúde/i)

    await registrarLeitura(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('valor_1 inválido.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(gets()).toHaveLength(1)
  })

  it('abrir de novo limpa o aviso anterior', async () => {
    const user = userEvent.setup()
    renderizarSaude()
    await screen.findByText(/nenhum registro de saúde/i)
    await registrarLeitura(user)
    await screen.findByText('Leitura registrada com sucesso.')

    await user.click(botaoDoCabecalho())

    expect(screen.queryByText('Leitura registrada com sucesso.')).not.toBeInTheDocument()
  })

  it('familiar registra para o idoso escolhido dentro do modal (POST /saude/idoso/:id)', async () => {
    const user = userEvent.setup()
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    renderizarSaude()
    await screen.findByText('Nenhum registro de saúde')

    await user.click(botaoDoCabecalho())
    const dialogo = screen.getByRole('dialog')
    await user.selectOptions(within(dialogo).getByLabelText('Idoso'), '8')
    await user.type(within(dialogo).getByLabelText('Tipo de medição'), 'glicemia')
    await user.type(within(dialogo).getByLabelText('Valor 1', { exact: true }), '95')
    await user.type(within(dialogo).getByLabelText('Unidade'), 'mg/dL')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar leitura' }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, o]) => metodoDe(o) === 'POST')
      expect(String(post?.[0])).toMatch(/\/saude\/idoso\/8$/)
    })
  })
})

describe('Saude — permissões', () => {
  beforeEach(() => {
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar' })
    mockUseIdosos.mockReturnValue(listaFamiliar)
  })

  it('sem permissão: sem botão de registrar (nem na lista vazia) e com aviso', async () => {
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: false, avisoSemFlag: true })
    renderizarSaude()

    expect(screen.queryByRole('button', { name: 'Registrar leitura' })).not.toBeInTheDocument()
    expect(screen.getByText(/não possui permissão/i).closest('[role="status"]')).not.toBeNull()
    expect(await screen.findByText('Nenhum registro de saúde')).toBeInTheDocument()
    expect(screen.getByText(/quando uma medição for registrada/i)).toBeInTheDocument()
  })

  it('com permissão: mostra o botão de registrar', async () => {
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    renderizarSaude()

    expect(botaoDoCabecalho()).toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('erro de permissão: alerta, mas o botão aparece (o 403 do servidor é a barreira)', async () => {
    mockUsePermissoes.mockReturnValue({ estado: 'erro', escrita: false, avisoSemFlag: false })
    renderizarSaude()

    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível verificar suas permissões/i)
    expect(botaoDoCabecalho()).toBeInTheDocument()
    await screen.findByText('Nenhum registro de saúde')
  })

  it('sem idosos vinculados não consulta a lista', () => {
    mockUseIdosos.mockReturnValue(listaSemIdosos)
    mockUsePermissoes.mockReturnValue({ estado: 'ok', escrita: false, avisoSemFlag: false })
    renderizarSaude()

    expect(gets()).toHaveLength(0)
  })

  it('mostra carregamento enquanto consulta permissões', () => {
    mockUsePermissoes.mockReturnValue({ estado: 'carregando', escrita: false, avisoSemFlag: false })
    renderizarSaude()

    expect(screen.getByText(/carregando informações de saúde/i)).toBeInTheDocument()
  })
})
