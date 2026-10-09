import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Avisos from './Avisos'
import { AvisosProvider } from '../contexts/AvisosContext'
import { AcessoContext, type ContextoAcesso } from '../contexts/useAcesso'
import type { Vinculo } from '../components/Vinculos/CardVinculo'
import { apiFalsa, erroApi } from '../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

const mockChamarApi = jest.fn()
jest.mock('../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))

// Dados fake só para o teste. Um instante de amanhã em São Paulo (offset fixo -03:00).
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
const AMANHA = fmt.format(new Date(Date.now() + 24 * 60 * 60 * 1000))

function vinculo(parcial: Partial<Vinculo>): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'pendente',
    data_solicitacao: '2026-10-01T10:00:00Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    decisao: null,
    permissoes: null,
    idoso: { id: 7, nome: 'Dona Ana Teste', email_mascarado: null },
    vinculado: { id: 3, nome: 'Pessoa Teste', email_mascarado: null },
    ...parcial,
  }
}

function acesso(parcial: Partial<ContextoAcesso>): ContextoAcesso {
  return {
    estado: 'ok',
    tipoPerfil: 'idoso',
    temVinculoAprovado: false,
    temVinculoPendente: false,
    vinculos: [],
    modoDecisao: 'idoso',
    ...parcial,
  }
}

async function renderizar(valor: ContextoAcesso) {
  const r = render(
    <MemoryRouter>
      <AcessoContext.Provider value={valor}>
        <AvisosProvider>
          <Avisos />
        </AvisosProvider>
      </AcessoContext.Provider>
    </MemoryRouter>,
  )
  await act(async () => {})
  return r
}

const consulta = {
  id: 10,
  tipo_evento: 'medico',
  titulo: 'Consulta teste',
  descricao: null,
  data_hora_inicio: `${AMANHA}T09:00:00-03:00`,
  data_hora_fim: null,
}

beforeEach(() => mockChamarApi.mockReset())

describe('Avisos', () => {
  it('idoso: pedidos para responder e compromissos de amanhã, cada um com link', async () => {
    mockChamarApi.mockImplementation(apiFalsa({ 'GET /agenda': () => ({ eventos: [consulta] }) }))
    const { container } = await renderizar(acesso({ vinculos: [vinculo({})] }))

    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument()
    expect(screen.getByText('Você tem 1 pedido de cuidador para responder.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /responder/i })).toHaveAttribute('href', '/cuidadores')
    expect(screen.getByText('Amanhã, 09:00: Consulta teste')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver agenda/i })).toHaveAttribute('href', '/agenda')
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
  })

  it('nenhum aviso: diz isso com clareza', async () => {
    mockChamarApi.mockImplementation(apiFalsa({ 'GET /agenda': () => ({ eventos: [] }) }))
    await renderizar(acesso({}))
    expect(screen.getByText('Nenhum aviso agora.')).toBeInTheDocument()
  })

  it('agenda com erro: mensagem fixa, sem texto técnico, e os pedidos continuam', async () => {
    mockChamarApi.mockImplementation(
      apiFalsa({
        'GET /agenda': () => {
          throw erroApi(500, 'detalhe interno')
        },
      }),
    )
    await renderizar(acesso({ vinculos: [vinculo({})] }))
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível verificar os compromissos agora.')
    expect(alerta).not.toHaveTextContent(/500|interno/)
    expect(screen.getByText('Você tem 1 pedido de cuidador para responder.')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum aviso agora.')).not.toBeInTheDocument()
  })

  it('vínculos sem carregar: avisa que os pedidos não puderam ser verificados', async () => {
    mockChamarApi.mockImplementation(apiFalsa({ 'GET /agenda': () => ({ eventos: [] }) }))
    await renderizar(acesso({ vinculos: null }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível verificar os pedidos de vínculo agora.')
  })

  it('cuidador: busca a agenda de cada idoso aprovado uma vez e mostra o nome do idoso', async () => {
    mockChamarApi.mockImplementation(
      apiFalsa({
        'GET /agenda/idoso/7': () => ({ eventos: [consulta] }),
        'GET /agenda/idoso/9': () => ({ eventos: [] }),
      }),
    )
    await renderizar(
      acesso({
        tipoPerfil: 'cuidador',
        temVinculoAprovado: true,
        vinculos: [
          vinculo({ status: 'aprovado', papel_do_chamador: 'vinculado' }),
          vinculo({ id: 2, status: 'aprovado', papel_do_chamador: 'vinculado', idoso: { id: 9, nome: 'Seu João Teste', email_mascarado: null } }),
        ],
      }),
    )
    expect(screen.getByText('Amanhã, 09:00: Consulta teste (Dona Ana Teste)')).toBeInTheDocument()
    expect(mockChamarApi).toHaveBeenCalledTimes(2)
  })
})
