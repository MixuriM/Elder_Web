import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import ModalCriarCompromisso from './ModalCriarCompromisso'
import type { ModoCriacao } from '../../lib/regrasAgenda'

expect.extend(toHaveNoViolations)

// Valores obviamente falsos, só de teste.
jest.mock('../../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

const TITULO = 'compromisso-falso-sigiloso'
const INICIO = '2026-10-10T09:00'
const FIM = '2026-10-10T10:30'
const ERRO_DO_SERVIDOR = 'mensagem-do-servidor-que-nao-deve-aparecer'
const AXE = { rules: { 'color-contrast': { enabled: false } } }

const fetchMock = jest.fn()

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response
}

function montar(modo: ModoCriacao, extra: { onCriado?: () => void; onFechar?: () => void } = {}) {
  const onCriado = extra.onCriado ?? jest.fn()
  const onFechar = extra.onFechar ?? jest.fn()

  render(
    <ModalCriarCompromisso
      aberto
      modo={modo}
      idosoId={modo === 'idoso' ? '' : '7'}
      idosoNome={modo === 'idoso' ? undefined : 'Idoso Teste Sete'}
      onCriado={onCriado}
      onFechar={onFechar}
    />,
  )

  return { onCriado, onFechar }
}

function preencher(user: ReturnType<typeof userEvent.setup>) {
  return async () => {
    await user.type(screen.getByLabelText('Título'), TITULO)
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: INICIO } })
  }
}

function corpoEnviado() {
  const [, init] = fetchMock.mock.calls[0]
  return JSON.parse(init.body)
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockResolvedValue(resposta(201, { id: 31 }))
  global.fetch = fetchMock
})

describe('ModalCriarCompromisso — estrutura', () => {
  it('fechado não renderiza', () => {
    render(<ModalCriarCompromisso aberto={false} modo="idoso" idosoId="" onCriado={jest.fn()} onFechar={jest.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('idoso: campos acessíveis, tipo pessoal ou médico, sem seletor de idoso nem nome', () => {
    montar('idoso')

    const dialogo = screen.getByRole('dialog', { name: 'Criar compromisso' })
    for (const rotulo of ['Tipo', 'Título', 'Descrição (opcional)', 'Início', 'Fim (opcional)']) {
      expect(within(dialogo).getByLabelText(rotulo)).toBeInTheDocument()
    }
    expect(within(dialogo).getAllByRole('option').map((o) => o.textContent)).toEqual(['Pessoal', 'Médico'])
    expect(within(dialogo).queryByLabelText('Idoso')).not.toBeInTheDocument()
    expect(within(dialogo).queryByText(/compromisso para:/i)).not.toBeInTheDocument()
  })

  it('familiar: mostra para qual idoso, só leitura, e tem o campo tipo', () => {
    montar('familiar')

    expect(screen.getByText(/compromisso para:/i)).toHaveTextContent('Idoso Teste Sete')
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Idoso')).not.toBeInTheDocument()
  })

  it('cuidador: mostra para qual idoso e não tem o campo tipo (só cuidado)', () => {
    montar('cuidador')

    expect(screen.getByText(/compromisso para:/i)).toHaveTextContent('Idoso Teste Sete')
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
  })

  it('título e descrição têm limite de 150 e 500 caracteres', () => {
    montar('idoso')

    expect(screen.getByLabelText('Título')).toHaveAttribute('maxLength', '150')
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveAttribute('maxLength', '500')
  })

  it('sem violações de acessibilidade', async () => {
    montar('familiar')

    expect(await axe(screen.getByRole('dialog'), AXE)).toHaveNoViolations()
  })
})

describe('ModalCriarCompromisso — envio', () => {
  it('idoso: POST /agenda, datas em UTC com Z, fim vazio omitido, sem idoso_id', async () => {
    const user = userEvent.setup()
    const { onCriado } = montar('idoso')

    await preencher(user)()
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/agenda$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer token-fake')
    expect(corpoEnviado()).toEqual({
      tipo_evento: 'pessoal',
      titulo: TITULO,
      data_hora_inicio: new Date(INICIO).toISOString(),
    })
  })

  it('tipo médico, descrição e fim vão no corpo', async () => {
    const user = userEvent.setup()
    montar('idoso')

    await preencher(user)()
    await user.selectOptions(screen.getByLabelText('Tipo'), 'medico')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'descricao-falsa')
    fireEvent.change(screen.getByLabelText('Fim (opcional)'), { target: { value: FIM } })
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(corpoEnviado()).toEqual({
      tipo_evento: 'medico',
      titulo: TITULO,
      descricao: 'descricao-falsa',
      data_hora_inicio: new Date(INICIO).toISOString(),
      data_hora_fim: new Date(FIM).toISOString(),
    })
  })

  it('familiar: POST /agenda/idoso/<id>, id só no caminho, nunca no corpo', async () => {
    const user = userEvent.setup()
    montar('familiar')

    await preencher(user)()
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/agenda\/idoso\/7$/)
    expect(corpoEnviado()).not.toHaveProperty('idoso_id')
    expect(corpoEnviado().tipo_evento).toBe('pessoal')
  })

  it("cuidador: POST /agenda/idoso/<id> com tipo_evento 'cuidado' fixo", async () => {
    const user = userEvent.setup()
    montar('cuidador')

    await preencher(user)()
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/agenda\/idoso\/7$/)
    expect(corpoEnviado().tipo_evento).toBe('cuidado')
  })

  it('validação no modal, sem chamar a API: início, título e fim antes do início', async () => {
    const user = userEvent.setup()
    montar('idoso')
    document.querySelector('form')?.setAttribute('novalidate', '')

    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o título do compromisso.')

    await user.type(screen.getByLabelText('Título'), TITULO)
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a data e hora de início.')

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: INICIO } })
    fireEvent.change(screen.getByLabelText('Fim (opcional)'), { target: { value: '2026-10-10T08:00' } })
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('O fim precisa ser depois do início.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Dados inválidos. Confira título, início e fim.'],
    [403, 'Você não tem permissão para criar este compromisso.'],
    [500, 'Não foi possível criar o compromisso.'],
  ])('erro %i: mensagem fixa em role=alert, sem ecoar o servidor; o que foi digitado continua', async (status, mensagem) => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(resposta(status, { error: ERRO_DO_SERVIDOR }))
    const { onCriado } = montar('idoso')

    await preencher(user)()
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).not.toHaveTextContent(ERRO_DO_SERVIDOR)
    expect(onCriado).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveValue(TITULO)
    expect(screen.getByRole('button', { name: 'Criar compromisso' })).toBeEnabled()
  })

  it('enquanto envia: campos e botões desabilitados, aria-busy e texto Criando...', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    fetchMock.mockImplementation(() => new Promise((r) => (liberar = () => r(resposta(201, { id: 1 })))))
    montar('idoso')

    await preencher(user)()
    await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    const botao = screen.getByRole('button', { name: 'Criando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText('Título')).toBeDisabled()

    liberar()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Criando...' })).not.toBeInTheDocument())
  })

  it('nunca loga o título nem o corpo, nem no erro', async () => {
    const user = userEvent.setup()
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      fetchMock.mockResolvedValue(resposta(400, { error: ERRO_DO_SERVIDOR }))
      montar('idoso')

      await preencher(user)()
      await user.click(screen.getByRole('button', { name: 'Criar compromisso' }))
      await screen.findByRole('alert')

      const logado = JSON.stringify(espioes.map((s) => s.mock.calls))
      expect(logado).not.toContain(TITULO)
      expect(logado).not.toContain(INICIO)
    } finally {
      espioes.forEach((s) => s.mockRestore())
    }
  })
})

describe('ModalCriarCompromisso — fechar', () => {
  it('Cancelar e Escape chamam onFechar sem enviar', async () => {
    const user = userEvent.setup()
    const { onFechar } = montar('idoso')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
