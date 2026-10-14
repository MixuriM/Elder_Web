import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import SolicitarVinculo from './SolicitarVinculo'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock

const AXE = { rules: { 'color-contrast': { enabled: false } } }
// Fixture: e-mail obviamente falso, só para o teste.
const EMAIL = 'idoso.teste@exemplo.test'

function montar(props: Partial<React.ComponentProps<typeof SolicitarVinculo>> = {}) {
  const onConcluido = jest.fn()
  const onFechar = jest.fn()
  const utils = render(<SolicitarVinculo tipo="cuidador" onConcluido={onConcluido} onFechar={onFechar} {...props} />)
  return { ...utils, onConcluido, onFechar }
}

async function enviar(email = EMAIL) {
  const campo = screen.getByLabelText(/e-mail do idoso/i)
  await userEvent.clear(campo)
  await userEvent.type(campo, email)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
}

describe('SolicitarVinculo', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('cuidador: envia POST solicitar-cuidador só com o e-mail sem espaços', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({ 'POST /vinculo/solicitar-cuidador': (c) => (corpos.push(c), { id: 1, status: 'pendente' }) }),
    )
    montar()
    await enviar(`  ${EMAIL}  `)
    await screen.findByText(/pedido enviado/i)
    expect(corpos).toEqual([{ email: EMAIL }])
  })

  it('familiar: envia POST solicitar-familiar', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({ 'POST /vinculo/solicitar-familiar': (c) => (corpos.push(c), { id: 2, status: 'pendente' }) }),
    )
    montar({ tipo: 'familiar' })
    await enviar()
    await screen.findByText(/pedido enviado/i)
    expect(corpos).toEqual([{ email: EMAIL }])
  })

  it('e-mail inicial vem preenchido', () => {
    montar({ emailInicial: EMAIL })
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveValue(EMAIL)
  })

  it.each(['', '   ', 'sem-arroba', 'a@b'])('e-mail inválido (%j) não envia e explica', async (valor) => {
    montar()
    const campo = screen.getByLabelText(/e-mail do idoso/i)
    if (valor.trim()) await userEvent.type(campo, valor)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(mockApi).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido, como nome@exemplo.com.')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
  })

  it('durante o envio o botão fica desligado e avisa; sucesso permanece e avisa a lista', async () => {
    let liberar!: (v: unknown) => void
    mockApi.mockImplementation(() => new Promise((r) => (liberar = r)))
    const { onConcluido, onFechar } = montar()
    await enviar()
    const botao = screen.getByRole('button', { name: 'Enviando...' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    liberar({ id: 1 })

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Pedido enviado. Aguarde a aprovação.')
    expect(aviso).toHaveFocus()
    expect(onConcluido).toHaveBeenCalledTimes(1)
    expect(onFechar).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/e-mail do idoso/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it.each([
    [400, 'Confira o e-mail digitado e tente de novo.'],
    [403, 'Seu perfil não pode fazer este pedido.'],
    [409, 'Já existe um pedido pendente ou você já está vinculado a esta pessoa.'],
    [500, 'Não foi possível enviar agora. Tente de novo em instantes.'],
  ])('status %s mostra a mensagem fixa e nunca o corpo da resposta', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/solicitar-cuidador': () => {
          throw erroApi(status, 'SEGREDO-do-corpo')
        },
      }),
    )
    montar()
    await enviar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeEnabled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('404 mostra a mensagem genérica do backend como veio, sem enriquecer', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/solicitar-cuidador': () => {
          throw erroApi(404, 'Nenhum idoso encontrado para este e-mail.')
        },
      }),
    )
    montar()
    await enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Nenhum idoso encontrado para este e-mail\.$/)
  })

  it('rede fora do ar (sem status) usa a mensagem fixa', async () => {
    mockApi.mockRejectedValue(new TypeError('Failed to fetch'))
    montar()
    await enviar()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível enviar agora. Tente de novo em instantes.')
    expect(alerta).not.toHaveTextContent('Failed to fetch')
  })

  // D4a (2026-10-14): o backend não devolve mais 422 com candidatos. O campo opcional "Nome do idoso" fica sempre
  // visível para o cuidador e vai como nome_idoso só quando preenchido.
  it('cuidador: o campo opcional "Nome do idoso" aparece desde o início e vai aparado como nome_idoso', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/solicitar-cuidador': (c) => {
          corpos.push(c)
          return { registrado: true }
        },
      }),
    )
    montar()
    await userEvent.type(screen.getByLabelText(/nome do idoso/i), '  Maria Teste  ')
    await enviar()
    await screen.findByText(/pedido enviado/i)
    expect(corpos).toEqual([{ email: EMAIL, nome_idoso: 'Maria Teste' }])
  })

  it('familiar: sem campo de nome do idoso', () => {
    montar({ tipo: 'familiar' })
    expect(screen.queryByLabelText(/nome do idoso/i)).not.toBeInTheDocument()
  })

  it('404 do cuidador mostra a mensagem genérica do backend', async () => {
    const MSG =
      'Nenhum idoso encontrado para este e-mail e nome. Se o e-mail for de um familiar que cuida de mais de um idoso, informe também o nome completo do idoso.'
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/solicitar-cuidador': () => {
          throw erroApi(404, MSG)
        },
      }),
    )
    montar()
    await enviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(MSG)
  })

  it('o formulário, o erro e o sucesso não têm violações do axe', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/solicitar-cuidador': () => {
          throw erroApi(409)
        },
      }),
    )
    const { container } = montar()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await enviar()
    await screen.findByRole('alert')
    expect(await axe(container, AXE)).toHaveNoViolations()
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/solicitar-cuidador': () => ({ id: 1 }) }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    await screen.findByRole('status')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
