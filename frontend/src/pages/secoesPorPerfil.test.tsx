import '@testing-library/jest-dom'

import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'
import Remedios from './Remedios'
import Agenda from './Agenda'
import Alimentacao from './Alimentacao'
import { AcessoContext, type Acesso } from '../contexts/useAcesso'
import { listaPerfilIdoso, listaUmIdoso } from '../hooks/idososFixtures'

// Seções de escrita só para o perfil que o backend aceita (regra fixa de ator, não decisão nova):
// registro próprio de saúde, agenda pessoal e refeição própria só do idoso; cuidador nunca cadastra
// medicamento nem refeição; cada formulário da agenda é de um ator. Perfil desconhecido mostra tudo (D3).

const mockUseIdosos = jest.fn()
jest.mock('../hooks/useIdososVinculados', () => ({ useIdososVinculados: () => mockUseIdosos() }))

const mockPermissoes = jest.fn()
jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: () => mockPermissoes(),
}))
jest.mock('../lib/permissoesDose', () => ({ usePermissoesDose: () => mockPermissoes() }))

const mockChamarApi = jest.fn()
jest.mock('../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))
jest.mock('../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

const MEDICAMENTO = {
  id: 1,
  nome: 'Remédio Teste',
  dosagem: '10 mg',
  frequencia: '1 vez ao dia',
  data_inicio: '2026-10-01',
  data_fim: null,
  observacoes: null,
  ativo: true,
  doses: [],
}

function comPerfil(tipoPerfil: string | null, ui: ReactNode) {
  const acesso: Acesso = { tipoPerfil, temVinculoAprovado: true, temVinculoPendente: false, estado: tipoPerfil ? 'ok' : 'erro' }
  return render(
    <MemoryRouter>
      <AcessoContext.Provider value={acesso}>{ui}</AcessoContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIdosos.mockReturnValue(listaUmIdoso)
  mockPermissoes.mockReturnValue({ estado: 'ok', escrita: false, avisoSemFlag: true })
  mockChamarApi.mockResolvedValue({ medicamentos: [MEDICAMENTO], registros: [], vinculos: [] })
  global.fetch = jest.fn()
})

describe('Saúde por perfil', () => {
  it('cuidador não vê o registro nem a edição próprios, e o título não diz "Minha"', () => {
    comPerfil('cuidador', <Saude />)
    expect(screen.queryByRole('heading', { name: 'Registrar leitura de saúde' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Editar meu registro' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Saúde do idoso' })).toBeInTheDocument()
  })

  it('idoso vê o registro próprio', () => {
    mockUseIdosos.mockReturnValue(listaPerfilIdoso)
    comPerfil('idoso', <Saude />)
    expect(screen.getByRole('heading', { name: 'Registrar leitura de saúde' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Minha Saúde' })).toBeInTheDocument()
  })
})

describe('Medicamentos por perfil', () => {
  it('cuidador não vê "Adicionar medicamento" nem "Marcar dose" sem a permissão', async () => {
    comPerfil('cuidador', <Remedios />)
    expect(await screen.findByText('Remédio Teste')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adicionar medicamento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar dose/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Medicamentos do idoso' })).toBeInTheDocument()
  })

  it('cuidador com a permissão vê "Marcar dose"', async () => {
    mockPermissoes.mockReturnValue({ estado: 'ok', escrita: true, avisoSemFlag: false })
    comPerfil('cuidador', <Remedios />)
    expect(await screen.findByRole('button', { name: /marcar dose/i })).toBeInTheDocument()
  })

  it('idoso vê "Adicionar medicamento" e "Marcar dose"', async () => {
    mockUseIdosos.mockReturnValue(listaPerfilIdoso)
    comPerfil('idoso', <Remedios />)
    expect(await screen.findByRole('button', { name: /marcar dose/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar medicamento/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Meus medicamentos' })).toBeInTheDocument()
  })
})

describe('Agenda por perfil', () => {
  // Um botão só ("Criar compromisso"); o formulário do modal muda conforme quem abre.
  async function abrirModal(perfil: string) {
    const user = userEvent.setup()
    comPerfil(perfil, <Agenda />)
    await user.click(await screen.findByRole('button', { name: 'Criar compromisso' }))
    return screen.getByRole('dialog', { name: 'Criar compromisso' })
  }

  it('cuidador abre o formulário de cuidado, sem o campo Tipo', async () => {
    const dialogo = await abrirModal('cuidador')

    expect(within(dialogo).getByLabelText('Título')).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Tipo')).not.toBeInTheDocument()
  })

  it('familiar abre o formulário com o campo Tipo e o nome do idoso', async () => {
    const dialogo = await abrirModal('familiar')

    expect(within(dialogo).getByLabelText('Tipo')).toBeInTheDocument()
    expect(within(dialogo).getByText(/compromisso para:/i)).toBeInTheDocument()
  })

  it('idoso abre o formulário próprio, com o campo Tipo e sem nome de outra pessoa', async () => {
    mockUseIdosos.mockReturnValue(listaPerfilIdoso)
    const dialogo = await abrirModal('idoso')

    expect(within(dialogo).getByLabelText('Título')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Tipo')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/compromisso para:/i)).not.toBeInTheDocument()
  })
})

describe('Alimentação por perfil', () => {
  it('cuidador não vê "Registrar refeição", só o histórico', () => {
    comPerfil('cuidador', <Alimentacao />)
    expect(screen.queryByRole('heading', { name: 'Registrar refeição' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Histórico alimentar' })).toBeInTheDocument()
  })

  it('familiar vê "Registrar refeição"', () => {
    comPerfil('familiar', <Alimentacao />)
    expect(screen.getByRole('heading', { name: 'Registrar refeição' })).toBeInTheDocument()
  })
})
