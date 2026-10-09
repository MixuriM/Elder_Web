import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ConvidarFamiliar from './ConvidarFamiliar'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }
const ROTA = 'POST /vinculo/convidar-familiar'
// Fixture: e-mail obviamente falso, só para o teste.
const EMAIL = 'familiar.teste@exemplo.test'

function montar() {
  const onConcluido = jest.fn()
  const onFechar = jest.fn()
  const utils = render(<ConvidarFamiliar onConcluido={onConcluido} onFechar={onFechar} />)
  return { ...utils, onConcluido, onFechar }
}

async function enviar(email = EMAIL) {
  const campo = screen.getByLabelText(/e-mail do familiar/i)
  await userEvent.clear(campo)
  if (email) await userEvent.type(campo, email)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))
}

describe('ConvidarFamiliar', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('envia só o e-mail sem espaços e mostra o resultado que permanece', async () => {
    const corpos: unknown[] = []
    let liberar!: (v: unknown) => void
    mockApi.mockImplementation((_c: string, o: RequestInit) => {
      corpos.push(JSON.parse(String(o.body)))
      return new Promise((r) => (liberar = r))
    })
    const { onConcluido, onFechar } = montar()
    await enviar(`  ${EMAIL}  `)
    const botao = screen.getByRole('button', { name: 'Enviando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    liberar({ registrado: true })

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Convite registrado.')
    expect(aviso).toHaveTextContent(/o vínculo é aprovado sozinho/i)
    expect(aviso).toHaveTextContent(/um novo convite substitui o anterior/i)
    expect(aviso).toHaveFocus()
    expect(corpos).toEqual([{ email: EMAIL }])
    expect(onConcluido).toHaveBeenCalledTimes(1)
    expect(onFechar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it.each(['', 'sem-arroba', 'a@b'])('e-mail inválido (%j) não envia e explica', async (valor) => {
    montar()
    await enviar(valor)
    expect(mockApi).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido, como nome@exemplo.com.')
    expect(screen.getByLabelText(/e-mail do familiar/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    [400, 'Confira o e-mail digitado e tente de novo.'],
    [403, 'Você não pode convidar um familiar agora.'],
    [409, 'Já existe um pedido pendente ou vínculo com esta pessoa.'],
    [500, 'Não foi possível enviar agora. Tente de novo em instantes.'],
  ])('status %s: mensagem fixa, sem eco do corpo, e dá para tentar de novo', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(status, 'SEGREDO-do-corpo modo_decisao')
        },
      }),
    )
    montar()
    await enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(document.body).not.toHaveTextContent('modo_decisao')
    expect(screen.getByRole('button', { name: 'Enviar convite' })).toBeEnabled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('não tem violações do axe (formulário, erro e sucesso)', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(409)
        },
      }),
    )
    const { container } = montar()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await enviar()
    await screen.findByRole('alert')
    expect(await axe(container, AXE)).toHaveNoViolations()
    mockApi.mockImplementation(apiFalsa({ [ROTA]: () => ({ registrado: true }) }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))
    await screen.findByRole('status')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
