import '@testing-library/jest-dom'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HistoricoSaude from '../components/Saude/HistoricoSaude'
import RegistrarSaudeIdoso from '../components/Saude/RegistrarSaudeIdoso'

// Integração: useIdososVinculados REAL (sem mock do hook) + chamarApi real. Só o Firebase (token),
// o perfil e o fetch são fakes. Confere a URL que de fato sai para a API.

const mockBuscarPerfil = jest.fn()

jest.mock('../services/perfilService', () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
}))

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: () => Promise.resolve('token-fake'),
}))

function resposta(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

function vinculo(id: number, nome: string, email: string | null) {
  return {
    status: 'aprovado',
    idoso: { id, nome, email_mascarado: email },
  }
}

const VINCULOS = {
  vinculos: [
    vinculo(11, 'Idoso Teste Onze', 'o***@teste.com'),
    vinculo(11, 'Idoso Teste Onze', 'o***@teste.com'), // titular: mesmo idoso, outro vínculo
    vinculo(22, 'Idoso Teste Vinte e Dois', null),
  ],
}

function urlsChamadas() {
  return (global.fetch as jest.Mock).mock.calls.map(
    ([url, opcoes]: [string, RequestInit]) => `${opcoes.method} ${url}`,
  )
}

beforeEach(() => {
  jest.clearAllMocks()

  global.fetch = jest.fn((url: string) => {
    if (url.endsWith('/vinculo?status=aprovado')) {
      return Promise.resolve(resposta(VINCULOS))
    }
    if (/\/saude\/idoso\/\d+$/.test(url)) {
      return Promise.resolve(resposta({ registros: [] }))
    }
    if (url.endsWith('/saude')) {
      return Promise.resolve(resposta({ registros: [] }))
    }
    return Promise.resolve(resposta({ error: 'rota inesperada' }, 404))
  }) as jest.Mock
})

describe('Saude — integração com o hook real', () => {
  it('familiar: lista deduplicada, pré-seleciona o primeiro e consulta /saude/idoso/:id do escolhido', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    const user = userEvent.setup()

    render(<HistoricoSaude />)

    const seletor = await screen.findByLabelText('Idoso')

    await waitFor(() => expect(seletor).toHaveValue('11'))
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'Idoso Teste Onze (o***@teste.com)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Idoso Teste Vinte e Dois' })).toBeInTheDocument()

    await user.selectOptions(seletor, '22')
    await user.click(screen.getByRole('button', { name: /ver histórico/i }))

    expect(await screen.findByText(/nenhum registro encontrado/i)).toBeInTheDocument()

    const urls = urlsChamadas()
    expect(urls.filter((u) => u.includes('/vinculo'))).toHaveLength(1)
    expect(urls.some((u) => /^GET .*\/saude\/idoso\/22$/.test(u))).toBe(true)
    expect(urls.some((u) => /\/saude\/idoso\/11$/.test(u))).toBe(false)
  })

  it('perfil idoso: sem seletor, não chama /vinculo e consulta /saude', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'idoso' })
    const user = userEvent.setup()

    render(<HistoricoSaude />)

    await user.click(await screen.findByRole('button', { name: /ver histórico/i }))

    expect(await screen.findByText(/nenhum registro encontrado/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    const urls = urlsChamadas()
    expect(urls.some((u) => u.includes('/vinculo'))).toBe(false)
    expect(urls.some((u) => /^GET .*\/saude$/.test(u))).toBe(true)
  })

  it('escrita com 2 idosos: só envia depois de escolher e posta no idoso escolhido', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    ;(global.fetch as jest.Mock).mockImplementation((url: string, opcoes: RequestInit) => {
      if (url.endsWith('/vinculo?status=aprovado')) return Promise.resolve(resposta(VINCULOS))
      if (opcoes.method === 'POST' && /\/saude\/idoso\/22$/.test(url)) {
        return Promise.resolve(resposta({ id: 99 }, 201))
      }
      return Promise.resolve(resposta({ error: 'rota inesperada' }, 404))
    })
    const user = userEvent.setup()

    render(<RegistrarSaudeIdoso />)

    const seletor = await screen.findByLabelText('Idoso')
    const botao = screen.getByRole('button', { name: /registrar leitura do idoso/i })

    expect(seletor).toHaveValue('')
    expect(botao).toBeDisabled()

    await user.selectOptions(seletor, '22')
    expect(botao).toBeEnabled()

    await user.type(screen.getByLabelText('Tipo de medição'), 'peso')
    await user.type(screen.getByLabelText('Valor 1'), '70')
    await user.type(screen.getByLabelText('Unidade'), 'kg')
    await user.click(botao)

    expect(await screen.findByText(/leitura registrada com sucesso/i)).toBeInTheDocument()
    expect(urlsChamadas().some((u) => /^POST .*\/saude\/idoso\/22$/.test(u))).toBe(true)
  })
})
