import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import Vinculos from './Vinculos'

expect.extend(toHaveNoViolations)

const mockGetCurrentUserToken = jest.fn()
jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response
}

// Dados fake, só para o teste de acessibilidade.
const vinculo = {
  id: 12,
  tipo_vinculo: 'cuidador',
  origem: 'solicitacao_cuidador',
  status: 'aprovado',
  data_solicitacao: '2026-10-01T10:00:00.000Z',
  data_resposta: '2026-10-02T10:00:00.000Z',
  confirmado_em: '2026-10-02T10:00:00.000Z',
  papel_do_chamador: 'vinculado',
  idoso: { id: 5, nome: 'Maria da Silva', email_mascarado: 'ma***@mail.com' },
  vinculado: { id: 8, nome: 'João da Silva', email_mascarado: 'jo***@mail.com' },
}

describe('Vinculos (acessibilidade)', () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset()
    mockGetCurrentUserToken.mockResolvedValue('token-fake')
    global.fetch = jest.fn()
  })

  it('lista vazia: tem h1 e não tem violações detectáveis pelo axe', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [] }))
    const { container } = render(<Vinculos />)

    await screen.findByText('Nenhum vínculo encontrado')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('lista com vínculos: tem h1 e não tem violações detectáveis pelo axe', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [vinculo] }))
    const { container } = render(<Vinculos />)

    await screen.findByText('João da Silva')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('com o diálogo DetalhesVinculo aberto: não tem violações detectáveis pelo axe', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [vinculo] }))
    const { container } = render(<Vinculos />)

    await screen.findByText('João da Silva')
    fireEvent.click(screen.getByRole('button', { name: /ver detalhes/i }))

    expect(screen.getByRole('dialog', { name: 'Detalhes do vínculo' })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
