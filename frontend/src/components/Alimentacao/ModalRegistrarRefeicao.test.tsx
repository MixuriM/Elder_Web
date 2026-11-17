import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

import ModalRegistrarRefeicao from './ModalRegistrarRefeicao'
import { listaDoisIdosos7, listaPerfilIdoso, listaSemIdosos, listaUmIdoso } from '../../hooks/idososFixtures'

expect.extend(toHaveNoViolations)

// Item 7.1 (RF-018), agora dentro do modal "Registrar refeição". Valores obviamente falsos, só de teste.
const AXE = { rules: { 'color-contrast': { enabled: false } } }
const DESCRICAO = 'descricao-falsa-sigilosa'
const DATA_LOCAL = '2026-10-10T12:30'
const ERRO_DO_SERVIDOR = 'mensagem-do-servidor-que-nao-deve-aparecer'

const OPCOES = [
  ['cafe_manha', 'Café da manhã'],
  ['lanche_manha', 'Lanche da manhã'],
  ['almoco', 'Almoço'],
  ['lanche_tarde', 'Lanche da tarde'],
  ['jantar', 'Jantar'],
  ['ceia', 'Ceia'],
]

const MENSAGENS: [number, string][] = [
  [400, 'Dados inválidos. Confira refeição, descrição e data e hora.'],
  [401, 'Sessão expirada. Entre novamente.'],
  [403, 'Você não tem permissão para registrar esta refeição.'],
  [404, 'Não foi possível registrar a refeição.'],
  [500, 'Não foi possível registrar a refeição.'],
]

const mockUseIdosos = jest.fn()
jest.mock('../../hooks/useIdososVinculados', () => ({ useIdososVinculados: () => mockUseIdosos() }))
jest.mock('../../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response
}

const fetchMock = jest.fn()

function montar() {
  const onRegistrado = jest.fn()
  const onFechar = jest.fn()
  const utils = render(
    <MemoryRouter>
      <ModalRegistrarRefeicao aberto onFechar={onFechar} onRegistrado={onRegistrado} />
    </MemoryRouter>,
  )
  return { onRegistrado, onFechar, ...utils }
}

const seletor = () => screen.queryByLabelText('Idoso', { exact: true })

function campos() {
  return {
    refeicao: screen.getByLabelText('Refeição', { exact: true }) as HTMLSelectElement,
    descricao: screen.getByLabelText('Descrição', { exact: true }),
    dataHora: screen.getByLabelText('Data e hora', { exact: true }),
    botao: screen.getByRole('button', { name: /^salvar refeição$/i }),
  }
}

async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>, idosoId = '', refeicao?: string) {
  const c = campos()
  if (idosoId) await user.selectOptions(seletor() as HTMLElement, idosoId)
  if (refeicao) await user.selectOptions(c.refeicao, refeicao)
  await user.type(c.descricao, DESCRICAO)
  fireEvent.change(c.dataHora, { target: { value: DATA_LOCAL } })
  await user.click(c.botao)
}

function chamada() {
  const [url, init] = fetchMock.mock.calls[0]
  return { url: String(url), init, corpo: JSON.parse(init.body) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  fetchMock.mockResolvedValue(resposta(201, { id: 31 }))
  global.fetch = fetchMock
})

describe('ModalRegistrarRefeicao — estrutura', () => {
  it('fechado não renderiza', () => {
    render(
      <MemoryRouter>
        <ModalRegistrarRefeicao aberto={false} onFechar={jest.fn()} onRegistrado={jest.fn()} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto: dialog modal nomeado, campos acessíveis por rótulo e botões Cancelar e Salvar refeição', () => {
    montar()

    expect(screen.getByRole('dialog', { name: 'Registrar refeição' })).toHaveAttribute('aria-modal', 'true')
    Object.values(campos()).forEach((el) => expect(el).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('o select de refeição tem exatamente os 6 valores do backend, com rótulos em português', () => {
    montar()

    expect(Array.from(campos().refeicao.options).map((o) => [o.value, o.textContent])).toEqual(OPCOES)
  })

  it('descrição é textarea com maxLength 500; descrição e data e hora são obrigatórias', () => {
    montar()
    const c = campos()

    expect(c.descricao.tagName).toBe('TEXTAREA')
    expect(c.descricao).toHaveAttribute('maxLength', '500')
    expect(c.descricao).toBeRequired()
    expect(c.dataHora).toHaveAttribute('type', 'datetime-local')
    expect(c.dataHora).toBeRequired()
  })

  it('perfil idoso não tem seletor de idoso', () => {
    montar()

    expect(seletor()).not.toBeInTheDocument()
  })

  it('cuidador ou familiar: seletor de idoso obrigatório, sem campo de ID digitável', () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7)
    montar()

    expect(seletor()?.tagName).toBe('SELECT')
    expect(seletor()).toBeRequired()
    expect(screen.queryByLabelText(/id do idoso/i)).not.toBeInTheDocument()
  })

  it('com 2 ou mais idosos: sem pré-seleção e envio desabilitado até escolher; com 1 idoso vem pré-selecionado', async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7)
    const user = userEvent.setup()
    const { unmount } = montar()

    expect(seletor()).toHaveValue('')
    expect(campos().botao).toBeDisabled()
    await user.selectOptions(seletor() as HTMLElement, '9')
    expect(campos().botao).toBeEnabled()
    unmount()

    mockUseIdosos.mockReturnValue(listaUmIdoso)
    montar()
    expect(seletor()).toHaveValue('7')
    expect(campos().botao).toBeEnabled()
  })

  it('0 idosos: orienta a solicitar vínculo e desabilita o registro', () => {
    mockUseIdosos.mockReturnValue(listaSemIdosos)
    montar()

    expect(screen.getByRole('link', { name: /solicite um vínculo/i })).toBeInTheDocument()
    expect(campos().botao).toBeDisabled()
  })

  it('sem violações de acessibilidade', async () => {
    montar()

    expect(await axe(screen.getByRole('dialog'), AXE)).toHaveNoViolations()
  })
})

describe('ModalRegistrarRefeicao — envio', () => {
  it('perfil idoso: POST /alimentacao com Authorization, Content-Type JSON e corpo exato, e chama onRegistrado', async () => {
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user)

    await waitFor(() => expect(onRegistrado).toHaveBeenCalledTimes(1))
    const { url, init, corpo } = chamada()
    expect(url).toMatch(/\/alimentacao$/)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer token-fake', 'Content-Type': 'application/json' })
    expect(corpo).toEqual({ refeicao: 'cafe_manha', descricao: DESCRICAO, data_hora: new Date(DATA_LOCAL).toISOString() })
  })

  it('idoso escolhido: POST /alimentacao/idoso/<id>, id só no caminho, nunca no corpo', async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7)
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user, '7', 'jantar')

    await waitFor(() => expect(onRegistrado).toHaveBeenCalled())
    expect(chamada().url).toMatch(/\/alimentacao\/idoso\/7$/)
    expect(chamada().corpo).toEqual({ refeicao: 'jantar', descricao: DESCRICAO, data_hora: new Date(DATA_LOCAL).toISOString() })
    expect(chamada().corpo).not.toHaveProperty('idoso_id')
  })

  it.each(OPCOES.map(([v]) => [v]))('refeição %s escolhida vai no corpo', async (valor) => {
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user, '', valor)

    await waitFor(() => expect(onRegistrado).toHaveBeenCalled())
    expect(chamada().corpo.refeicao).toBe(valor)
  })

  it.each(MENSAGENS)('%i: mensagem fixa em role=alert, sem ecoar o corpo do servidor, e não fecha', async (status, msg) => {
    fetchMock.mockResolvedValue(resposta(status, { error: ERRO_DO_SERVIDOR }))
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(msg)
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument()
    expect(onRegistrado).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Descrição')).toHaveValue(DESCRICAO)
  })

  it('falha de rede: mensagem genérica fixa, sem ecoar o texto do erro', async () => {
    fetchMock.mockRejectedValue(new Error(ERRO_DO_SERVIDOR))
    const user = userEvent.setup()
    montar()

    await preencherEEnviar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar a refeição.')
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument()
  })

  it('201 sem o id criado vira erro, nunca sucesso', async () => {
    fetchMock.mockResolvedValue(resposta(201, {}))
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onRegistrado).not.toHaveBeenCalled()
  })

  it('enquanto envia: campos e botões desabilitados, aria-busy e texto Salvando...', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    montar()

    await preencherEEnviar(user)

    const botao = await screen.findByRole('button', { name: 'Salvando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText('Descrição')).toBeDisabled()
  })

  it('reenviar depois de um erro limpa a mensagem anterior', async () => {
    fetchMock.mockResolvedValueOnce(resposta(403, {})).mockResolvedValueOnce(resposta(201, { id: 9 }))
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencherEEnviar(user)
    await screen.findByRole('alert')
    await user.click(campos().botao)

    await waitFor(() => expect(onRegistrado).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('nunca loga a descrição em console.*, nem no erro', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      fetchMock.mockResolvedValue(resposta(400, { error: ERRO_DO_SERVIDOR }))
      const user = userEvent.setup()
      montar()

      await preencherEEnviar(user)
      await screen.findByRole('alert')

      expect(JSON.stringify(espioes.map((s) => s.mock.calls))).not.toContain(DESCRICAO)
    } finally {
      espioes.forEach((s) => s.mockRestore())
    }
  })
})

describe('ModalRegistrarRefeicao — fechar', () => {
  it('Cancelar e Escape chamam onFechar sem enviar', async () => {
    const user = userEvent.setup()
    const { onFechar } = montar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
