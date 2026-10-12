import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'
import { AcessoProvider } from '../contexts/AcessoContext'

// Home do cuidador com o AcessoProvider real: o cartão depende de temVinculoPendente (que ignora convite vencido) e da
// lista de vínculos (que decide o texto de convite). Dados fake, só para o teste.
const mockBuscarPerfil = jest.fn()
const mockChamarApi = jest.fn()
jest.mock('../services/perfilService', () => ({
  buscarPerfil: (...a: unknown[]) => mockBuscarPerfil(...a),
}))
jest.mock('../lib/chamarApi', () => ({
  chamarApi: (...a: unknown[]) => mockChamarApi(...a),
}))

const DIA = 24 * 60 * 60 * 1000
// Datas relativas a agora: o convite vale 7 dias, então uma data fixa viraria "vencido" com o tempo.
const vinculo = (extra: Record<string, unknown>) => ({
  id: 40,
  tipo_vinculo: 'cuidador',
  origem: 'convite_idoso',
  status: 'pendente',
  papel_do_chamador: 'vinculado',
  data_solicitacao: new Date(Date.now() - DIA).toISOString(),
  data_resposta: null,
  confirmado_em: null,
  permissoes: null,
  idoso: { id: null, nome: 'Maria Idosa', email_mascarado: 'ma***@mail.test' },
  vinculado: { id: 8, nome: 'João Cuidador', email_mascarado: 'jo***@mail.test' },
  ...extra,
})
const vencido = (extra: Record<string, unknown> = {}) =>
  vinculo({ data_solicitacao: new Date(Date.now() - 8 * DIA).toISOString(), ...extra })

async function renderizarHome(vinculos: unknown[]) {
  mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
  mockChamarApi.mockImplementation((caminho: string) =>
    caminho === '/vinculo' ? Promise.resolve({ vinculos }) : new Promise(() => {}),
  )
  render(
    <AcessoProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AcessoProvider>,
  )
  await act(async () => {})
}

describe('Home do cuidador: convite com o acesso real', () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset()
    mockChamarApi.mockReset()
  })

  it('só convite vigente: texto de convite com link para Cuidadores', async () => {
    await renderizarHome([vinculo({})])
    expect(await screen.findByRole('heading', { name: 'Convite para ser cuidador' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Cuidadores' })).toHaveAttribute('href', '/cuidadores')
  })

  it('só convite vencido: ninguém para aprovar, então o texto de quem ainda não se vinculou', async () => {
    await renderizarHome([vencido()])
    expect(await screen.findByRole('heading', { name: 'Vincule-se a um idoso' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Aguardando aprovação' })).not.toBeInTheDocument()
    expect(screen.queryByText(/você recebeu um convite/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toHaveAttribute('href', '/cuidadores')
  })

  it('convite vencido mais pedido comum pendente: o pedido ainda aguarda aprovação', async () => {
    await renderizarHome([vencido(), vinculo({ id: 41, origem: 'solicitacao_cuidador' })])
    expect(await screen.findByRole('heading', { name: 'Aguardando aprovação' })).toBeInTheDocument()
    expect(screen.queryByText(/você recebeu um convite/i)).not.toBeInTheDocument()
  })
})
