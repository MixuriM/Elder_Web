import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import CadastrarIdoso from './CadastrarIdoso'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }
const ROTA = 'POST /usuario/cadastrar-idoso'

// Fixtures: dados obviamente falsos, só para o teste.
const NOME = 'Maria Teste'
const EMAIL = 'maria.teste@exemplo.test'
const TELEFONE = '11999990000'
const ERRO_409 = 'Já existe uma conta com este e-mail.'
const PASSO_409 = "Se essa pessoa é o idoso que você quer acompanhar, use 'Solicitar vínculo' informando este e-mail."

function montar() {
  const onConcluido = jest.fn()
  const onFechar = jest.fn()
  const onPedirVinculo = jest.fn()
  const utils = render(<CadastrarIdoso onConcluido={onConcluido} onFechar={onFechar} onPedirVinculo={onPedirVinculo} />)
  return { ...utils, onConcluido, onFechar, onPedirVinculo }
}

async function preencher({ nome = NOME, email = EMAIL, telefone = '' } = {}) {
  await userEvent.clear(screen.getByLabelText(/nome do idoso/i))
  if (nome) await userEvent.type(screen.getByLabelText(/nome do idoso/i), nome)
  await userEvent.clear(screen.getByLabelText(/e-mail do idoso/i))
  if (email) await userEvent.type(screen.getByLabelText(/e-mail do idoso/i), email)
  await userEvent.clear(screen.getByLabelText(/telefone/i))
  if (telefone) await userEvent.type(screen.getByLabelText(/telefone/i), telefone)
}

const seguir = () => userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
const aceitar = () => userEvent.click(screen.getByRole('button', { name: 'Aceitar e cadastrar' }))

async function ateOTermo(dados = {}) {
  await preencher(dados)
  await seguir()
  await screen.findByRole('heading', { name: 'Termo de responsabilidade' })
}

describe('CadastrarIdoso', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('primeiro passo: campos rotulados e limites iguais aos do backend', () => {
    montar()
    expect(screen.getByLabelText(/nome do idoso/i)).toHaveAttribute('maxLength', '150')
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveAttribute('maxLength', '255')
    expect(screen.getByLabelText(/telefone \(opcional\)/i)).toHaveAttribute('maxLength', '20')
  })

  it('campos vazios ou e-mail inválido não avançam e explicam, com o foco no primeiro erro', async () => {
    montar()
    await seguir()
    expect(screen.getByRole('alert')).toHaveTextContent('Confira os campos marcados.')
    expect(screen.getByText('Digite o nome do idoso.')).toBeInTheDocument()
    expect(screen.getByText('Digite um e-mail válido, como nome@exemplo.com.')).toBeInTheDocument()
    expect(screen.getByLabelText(/nome do idoso/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/nome do idoso/i)).toHaveFocus()
    expect(screen.queryByRole('heading', { name: 'Termo de responsabilidade' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/nome do idoso/i), NOME)
    await userEvent.type(screen.getByLabelText(/e-mail do idoso/i), 'sem-arroba')
    await seguir()
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveFocus()
    expect(mockApi).not.toHaveBeenCalled()
  })

  it('o termo aparece antes de enviar; sem marcar a caixa não envia', async () => {
    montar()
    await ateOTermo()
    expect(mockApi).not.toHaveBeenCalled()
    await aceitar()
    expect(screen.getByRole('alert')).toHaveTextContent('Marque a caixa para aceitar o termo.')
    expect(mockApi).not.toHaveBeenCalled()
  })

  it('Voltar no termo mantém o que foi digitado', async () => {
    montar()
    await ateOTermo({ telefone: TELEFONE })
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByLabelText(/nome do idoso/i)).toHaveValue(NOME)
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveValue(EMAIL)
    expect(screen.getByLabelText(/telefone/i)).toHaveValue(TELEFONE)
  })

  it('voltar e retornar ao termo exige aceitar de novo', async () => {
    montar()
    await ateOTermo()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await seguir()
    expect(screen.getByRole('checkbox', { name: /li e aceito o termo/i })).not.toBeChecked()
  })

  it('envia nome, e-mail, telefone e o aceite, sem espaços sobrando', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({ [ROTA]: (c) => (corpos.push(c), { usuario: { id: 7 }, vinculo: { id: 1, status: 'aprovado' } }) }),
    )
    montar()
    await ateOTermo({ nome: `  ${NOME}  `, email: `  ${EMAIL}  `, telefone: TELEFONE })
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    await screen.findByRole('status')
    expect(corpos).toEqual([
      { nome: NOME, email: EMAIL, telefone: TELEFONE, aceita_termo_responsabilidade: true },
    ])
  })

  it('telefone em branco não vai no corpo', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA]: (c) => (corpos.push(c), { vinculo: { status: 'aprovado' } }) }))
    montar()
    await ateOTermo()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    await screen.findByRole('status')
    expect(corpos).toEqual([{ nome: NOME, email: EMAIL, aceita_termo_responsabilidade: true }])
  })

  it.each([
    ['aprovado', 'O vínculo já está aprovado.'],
    ['pendente', 'O vínculo fica pendente até você confirmar o seu e-mail.'],
  ])('sucesso com vínculo %s: mensagem que permanece e a página é avisada', async (status, frase) => {
    let liberar!: (v: unknown) => void
    mockApi.mockImplementation(() => new Promise((r) => (liberar = r)))
    const { onConcluido, onFechar } = montar()
    await ateOTermo()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    const botao = screen.getByRole('button', { name: 'Enviando...' })
    expect(botao).toBeDisabled()
    liberar({ usuario: { id: 7 }, vinculo: { id: 1, status } })

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent(`Idoso cadastrado: ${NOME}.`)
    expect(aviso).toHaveTextContent(frase)
    expect(aviso).toHaveFocus()
    expect(onConcluido).toHaveBeenCalledTimes(1)
    expect(onFechar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('409: mostra a mensagem e o próximo passo como vieram, com ações claras', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(409, ERRO_409, { proximo_passo: PASSO_409 })
        },
      }),
    )
    const { onPedirVinculo } = montar()
    await ateOTermo({ telefone: TELEFONE })
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()

    const conflito = await screen.findByRole('alert')
    expect(conflito).toHaveTextContent(ERRO_409)
    expect(conflito).toHaveTextContent(PASSO_409)
    expect(conflito).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Corrigir o e-mail digitado' }))
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveValue(EMAIL)
    expect(screen.getByLabelText(/nome do idoso/i)).toHaveValue(NOME)

    await seguir()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Pedir vínculo com este e-mail' }))
    expect(onPedirVinculo).toHaveBeenCalledWith(EMAIL)
  })

  it.each([
    [400, 'Confira os dados do idoso e tente de novo.'],
    [403, 'Seu perfil não pode cadastrar um idoso.'],
    [500, 'Não foi possível cadastrar agora. Tente de novo em instantes.'],
  ])('status %s: mensagem fixa, sem eco do corpo, e dá para tentar de novo', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(status, 'SEGREDO-do-corpo')
        },
      }),
    )
    montar()
    await ateOTermo()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(screen.getByRole('button', { name: 'Aceitar e cadastrar' })).toBeEnabled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('não tem violações do axe (dados, termo, erro, conflito e sucesso)', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(409, ERRO_409, { proximo_passo: PASSO_409 })
        },
      }),
    )
    const { container } = montar()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await seguir()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await ateOTermo()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    await screen.findByRole('alert')
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir o e-mail digitado' }))
    mockApi.mockImplementation(apiFalsa({ [ROTA]: () => ({ usuario: {}, vinculo: { status: 'aprovado' } }) }))
    await seguir()
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await aceitar()
    await screen.findByRole('status')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
