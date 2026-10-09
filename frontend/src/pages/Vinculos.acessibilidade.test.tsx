import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import VinculoDetalhe from './VinculoDetalhe'
import Vinculos from './Vinculos'

expect.extend(toHaveNoViolations)

const mockGetCurrentUserToken = jest.fn()
jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function renderVinculos() {
  return render(
    <MemoryRouter initialEntries={['/cuidadores']}>
      <Vinculos tipo="cuidador" />
    </MemoryRouter>
  )
}

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
  papel_do_chamador: 'dono',
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
    const { container } = renderVinculos()

    await screen.findByText('Nenhum cuidador vinculado')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/Home')
    expect(screen.getByRole('button', { name: 'Ativar modo escuro' })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('lista com vínculos: tem h1 e não tem violações detectáveis pelo axe', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [vinculo] }))
    const { container } = renderVinculos()

    await screen.findByText('João da Silva')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('link para detalhes: abre uma URL separada sem substituir a lista', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [vinculo] }))
    const { container } = renderVinculos()

    await screen.findByText('João da Silva')

    const link = screen.getByRole('link', { name: /ver detalhes de joão da silva/i })
    expect(link).toHaveAttribute('href', '/vinculos/12')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('heading', { name: 'Pessoas vinculadas' })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('página de detalhes: tem h1 e não tem violações detectáveis pelo axe', async () => {
    jest.mocked(global.fetch).mockResolvedValue(respostaJson(200, { vinculos: [vinculo] }))
    const { container } = render(
      <MemoryRouter initialEntries={['/vinculos/12']}>
        <Routes>
          <Route path="/vinculos/:id" element={<VinculoDetalhe />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'João da Silva' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/cuidadores')
    expect(screen.getByRole('button', { name: 'Ativar modo escuro' })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
