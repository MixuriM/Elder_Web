import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

import ModalRegistrarSaude from './ModalRegistrarSaude'
import { listaFamiliar, listaPerfilIdoso, listaSemIdosos } from '../../hooks/idososFixtures'

expect.extend(toHaveNoViolations)

// Itens 4.1 e 4.2 (RF-008), agora dentro do modal "Registrar leitura de saúde". Valores obviamente falsos, só de teste.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

const mockUseIdosos = jest.fn()
jest.mock('../../hooks/useIdososVinculados', () => ({ useIdososVinculados: () => mockUseIdosos() }))
jest.mock('../../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response
}

const fetchMock = jest.fn()

function montar(terceiro = false) {
  const onRegistrado = jest.fn()
  const onFechar = jest.fn()
  render(
    <MemoryRouter>
      <ModalRegistrarSaude aberto terceiro={terceiro} onFechar={onFechar} onRegistrado={onRegistrado} />
    </MemoryRouter>,
  )
  return { onRegistrado, onFechar }
}

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tipo de medição'), 'pressao')
  await user.type(screen.getByLabelText('Valor 1', { exact: true }), '120')
  await user.type(screen.getByLabelText('Unidade'), 'mmHg')
}

const salvar = () => screen.getByRole('button', { name: /^salvar leitura$/i })

function chamada() {
  const [url, init] = fetchMock.mock.calls[0]
  return { url: String(url), init, corpo: JSON.parse(init.body) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  fetchMock.mockResolvedValue(resposta(201, { id: 55 }))
  global.fetch = fetchMock
})

describe('ModalRegistrarSaude — estrutura', () => {
  it('fechado não renderiza', () => {
    render(
      <MemoryRouter>
        <ModalRegistrarSaude aberto={false} terceiro={false} onFechar={jest.fn()} onRegistrado={jest.fn()} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('idoso: dialog modal com os campos rotulados e sem seletor de idoso', () => {
    montar()

    expect(screen.getByRole('dialog', { name: 'Registrar leitura de saúde' })).toHaveAttribute('aria-modal', 'true')
    for (const rotulo of ['Tipo de medição', 'Valor 1', 'Valor 2 (opcional)', 'Unidade', 'Data e hora (opcional)', 'Observações (opcional)']) {
      expect(screen.getByLabelText(rotulo, { exact: true })).toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Idoso')).not.toBeInTheDocument()
  })

  it('terceiro: seletor de idoso obrigatório, sem pré-seleção com 2 ou mais idosos, e envio bloqueado até escolher', async () => {
    mockUseIdosos.mockReturnValue(listaFamiliar)
    const user = userEvent.setup()
    montar(true)

    const seletor = screen.getByLabelText('Idoso')
    expect(seletor).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Selecione o idoso' })).toBeInTheDocument()
    expect(salvar()).toBeDisabled()
    await user.selectOptions(seletor, '8')
    expect(salvar()).toBeEnabled()
  })

  it('terceiro sem idoso vinculado: orienta a solicitar vínculo e bloqueia o envio', () => {
    mockUseIdosos.mockReturnValue(listaSemIdosos)
    montar(true)

    expect(screen.getByRole('link', { name: /solicite um vínculo/i })).toBeInTheDocument()
    expect(salvar()).toBeDisabled()
  })

  it('sem violações de acessibilidade', async () => {
    montar()

    expect(await axe(screen.getByRole('dialog'), AXE)).toHaveNoViolations()
  })
})

describe('ModalRegistrarSaude — envio', () => {
  it('idoso: POST /saude com números, data e autenticação, e chama onRegistrado', async () => {
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencher(user)
    await user.type(screen.getByLabelText('Valor 2 (opcional)'), '80')
    fireEvent.change(screen.getByLabelText('Data e hora (opcional)'), { target: { value: '2026-09-23T10:00' } })
    await user.click(salvar())

    await waitFor(() => expect(onRegistrado).toHaveBeenCalledTimes(1))
    const { url, init, corpo } = chamada()
    expect(url).toMatch(/\/saude$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer token-fake')
    expect(corpo).toEqual({
      tipo_medicao: 'pressao',
      valor_1: 120,
      valor_2: 80,
      unidade: 'mmHg',
      data_hora: new Date('2026-09-23T10:00').toISOString(),
    })
  })

  it('campos opcionais em branco não vão no corpo, e nunca vão idoso_id nem autoria', async () => {
    const user = userEvent.setup()
    montar()

    await preencher(user)
    await user.click(salvar())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(chamada().corpo).toEqual({ tipo_medicao: 'pressao', valor_1: 120, unidade: 'mmHg' })
    expect(chamada().corpo).not.toHaveProperty('idoso_id')
    expect(chamada().corpo).not.toHaveProperty('registrado_por_id')
    expect(chamada().corpo).not.toHaveProperty('editado_por_id')
  })

  it('terceiro: POST /saude/idoso/:id, id só no caminho', async () => {
    mockUseIdosos.mockReturnValue(listaFamiliar)
    const user = userEvent.setup()
    const { onRegistrado } = montar(true)

    await user.selectOptions(screen.getByLabelText('Idoso'), '5')
    await preencher(user)
    await user.click(salvar())

    await waitFor(() => expect(onRegistrado).toHaveBeenCalled())
    expect(chamada().url).toMatch(/\/saude\/idoso\/5$/)
    expect(chamada().corpo).toMatchObject({ valor_1: 120 })
    expect(chamada().corpo).not.toHaveProperty('idoso_id')
  })

  it('erro da API em role=alert dentro do modal; não fecha e o que foi digitado continua', async () => {
    fetchMock.mockResolvedValue(resposta(400, { error: 'valor_1 inválido.' }))
    const user = userEvent.setup()
    const { onRegistrado } = montar()

    await preencher(user)
    await user.click(salvar())

    expect(await screen.findByRole('alert')).toHaveTextContent('valor_1 inválido.')
    expect(onRegistrado).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Tipo de medição')).toHaveValue('pressao')
    expect(salvar()).toBeEnabled()
  })

  it('enquanto envia: campos e botões desabilitados, aria-busy e texto Salvando...', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    montar()

    await preencher(user)
    await user.click(salvar())

    const botao = await screen.findByRole('button', { name: 'Salvando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText('Tipo de medição')).toBeDisabled()
  })

  it('não imprime valores clínicos no console quando o cadastro falha', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      fetchMock.mockResolvedValue(resposta(400, { error: 'valor inválido' }))
      const user = userEvent.setup()
      montar()

      await user.type(screen.getByLabelText('Tipo de medição'), 'pressao')
      await user.type(screen.getByLabelText('Valor 1', { exact: true }), '123.45')
      await user.type(screen.getByLabelText('Unidade'), 'mmHg')
      await user.type(screen.getByLabelText('Observações (opcional)'), 'segredo-clinico')
      await user.click(salvar())
      await screen.findByRole('alert')

      const logado = JSON.stringify(espioes.map((s) => s.mock.calls))
      expect(logado).not.toContain('123.45')
      expect(logado).not.toContain('segredo-clinico')
    } finally {
      espioes.forEach((s) => s.mockRestore())
    }
  })
})

describe('ModalRegistrarSaude — fechar', () => {
  it('Cancelar e Escape chamam onFechar sem enviar', async () => {
    const user = userEvent.setup()
    const { onFechar } = montar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
