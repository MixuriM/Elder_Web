import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo com perfil e vínculos mockados (dados fake, só para o teste).
let mockPerfil = 'idoso'
let mockVinculos: unknown[] = []
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb({ uid: 'u1' })
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
  logoutUser: jest.fn(),
}))
jest.mock('./services/perfilService', () => ({
  buscarPerfil: () => Promise.resolve({ nome: 'Pessoa Teste', tipo_perfil: mockPerfil }),
  buscarFotoPerfil: () => Promise.resolve(null),
}))
jest.mock('./lib/chamarApi', () => ({
  chamarApi: () => Promise.resolve({ vinculos: mockVinculos }),
}))

function renderApp(caminho: string) {
  window.history.pushState({}, '', caminho)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

// Dados fake: vínculo próprio (papel 'vinculado') do cuidador, com o idoso oculto até aprovar.
const vinculo = (status: string) => ({
  id: 1,
  tipo_vinculo: 'cuidador',
  origem: 'solicitacao_cuidador',
  status,
  data_solicitacao: '2026-10-01T10:00:00.000Z',
  data_resposta: null,
  confirmado_em: null,
  papel_do_chamador: 'vinculado',
  idoso: { id: null, nome: null, email_mascarado: null },
  vinculado: { id: 2, nome: 'Cuidador Teste', email_mascarado: 'cu***@teste.com' },
})

const AVISO = 'Para usar esta área, vincule-se a um idoso.'

describe('App: acesso por perfil e vínculo', () => {
  it('familiar sem vínculo aprovado em /agenda: vai para /familia com o aviso', async () => {
    mockPerfil = 'familiar'
    mockVinculos = []
    renderApp('/agenda')

    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/familia')
    expect(screen.queryByRole('link', { name: 'Agenda' })).not.toBeInTheDocument()
  })

  it('cuidador com vínculo só pendente em /saude: vai para /cuidadores com o aviso', async () => {
    mockPerfil = 'cuidador'
    mockVinculos = [vinculo('pendente')]
    renderApp('/saude')

    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cuidadores')
  })

  it('cuidador com vínculo aprovado em /agenda: não é redirecionado e o menu mostra Agenda', async () => {
    mockPerfil = 'cuidador'
    mockVinculos = [vinculo('aprovado')]
    renderApp('/agenda')

    expect(await screen.findByRole('link', { name: 'Agenda' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/agenda')
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it('idoso nunca é bloqueado', async () => {
    mockPerfil = 'idoso'
    mockVinculos = []
    renderApp('/alimentacao')

    expect(await screen.findByRole('link', { name: 'Alimentação e Nutrição' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/alimentacao'))
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })
})
