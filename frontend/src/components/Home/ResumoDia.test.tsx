import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ResumoDia from './ResumoDia'
import Home from '../../pages/Home'
import { AcessoContext, type ContextoAcesso } from '../../contexts/useAcesso'
import type { Vinculo } from '../Vinculos/CardVinculo'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

const mockChamarApi = jest.fn()
jest.mock('../../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))

// Dados fake só para o teste. Instantes de hoje em São Paulo (offset fixo -03:00, sem horário de verão).
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
const HOJE = fmt.format(new Date())
const hoje = (hora: string) => `${HOJE}T${hora}:00-03:00`
const ANTIGO = '2001-01-01T12:00:00-03:00'

const permissoesCuidador = (ligadas: boolean) => ({
  permite_registrar_saude: ligadas,
  permite_marcar_dose: ligadas,
  permite_criar_evento_cuidado: ligadas,
})

function vinculo(parcial: Partial<Vinculo>): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'aprovado',
    data_solicitacao: '2026-10-01T10:00:00Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'vinculado',
    decisao: null,
    permissoes: permissoesCuidador(false),
    idoso: { id: 7, nome: 'Dona Ana Teste', email_mascarado: 'a***@mail.com' },
    vinculado: { id: 3, nome: 'Eu', email_mascarado: null },
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

function renderizar(valor: ContextoAcesso, componente = <ResumoDia />) {
  return render(
    <MemoryRouter>
      <AcessoContext.Provider value={valor}>{componente}</AcessoContext.Provider>
    </MemoryRouter>,
  )
}

const vazio = { eventos: [], registros: [], medicamentos: [] }
function rotasVazias(prefixo: string) {
  return {
    [`GET /agenda${prefixo}`]: () => ({ eventos: vazio.eventos }),
    [`GET /saude${prefixo}`]: () => ({ registros: vazio.registros }),
    [`GET /remedios${prefixo}`]: () => ({ medicamentos: vazio.medicamentos }),
  }
}

const card = (nome: RegExp) => screen.getByRole('region', { name: nome })

beforeEach(() => mockChamarApi.mockReset())

describe('ResumoDia: idoso', () => {
  it('mostra compromissos de hoje, saúde recente e medicamentos com os próprios dados', async () => {
    mockChamarApi.mockImplementation(
      apiFalsa({
        'GET /agenda': () => ({
          eventos: [
            { id: 1, tipo_evento: 'medico', titulo: 'Consulta teste', descricao: null, data_hora_inicio: hoje('14:30'), data_hora_fim: null },
            { id: 2, tipo_evento: 'pessoal', titulo: 'Passeio antigo', descricao: null, data_hora_inicio: ANTIGO, data_hora_fim: null },
          ],
        }),
        'GET /saude': () => ({
          registros: [
            { id: 5, tipo_medicao: 'Pressão', valor_1: 12, valor_2: 8, unidade: 'cmHg', data_hora: hoje('08:00') },
          ],
        }),
        'GET /remedios': () => ({
          medicamentos: [
            {
              id: 1,
              ativo: true,
              doses: [
                { status_administracao: 'administrado', data_hora_administracao: hoje('09:00') },
                { status_administracao: 'pulado', data_hora_administracao: hoje('10:00') },
                { status_administracao: 'administrado', data_hora_administracao: ANTIGO },
              ],
            },
            { id: 2, ativo: false, doses: [] },
          ],
        }),
      }),
    )
    renderizar(acesso({}))

    const agenda = card(/compromissos de hoje/i)
    expect(await within(agenda).findByText('Consulta teste')).toBeInTheDocument()
    expect(within(agenda).getByText('14:30')).toBeInTheDocument()
    expect(within(agenda).queryByText('Passeio antigo')).not.toBeInTheDocument()
    expect(within(agenda).getByRole('link', { name: /ver agenda/i })).toHaveAttribute('href', '/agenda')

    const saude = card(/saúde/i)
    expect(await within(saude).findByText(/Pressão/)).toBeInTheDocument()
    expect(within(saude).getByText(/12 \/ 8 cmHg/)).toBeInTheDocument()
    expect(within(saude).getByRole('link', { name: /ver saúde/i })).toHaveAttribute('href', '/saude')

    const remedios = card(/medicamentos/i)
    expect(await within(remedios).findByText(/1 medicamento ativo/i)).toBeInTheDocument()
    expect(within(remedios).getByText(/2 doses registradas hoje/i)).toBeInTheDocument()
    expect(within(remedios).getByText(/1 dada/i)).toBeInTheDocument()
    expect(within(remedios).getByText(/1 pulada/i)).toBeInTheDocument()
    expect(remedios).not.toHaveTextContent(/falta|atrasad/i)
    expect(within(remedios).getByRole('link', { name: /ver medicamentos/i })).toHaveAttribute('href', '/remedios')

    expect(screen.queryByLabelText(/ver o resumo de/i)).not.toBeInTheDocument()
  })

  it('vazio: diz o que fazer em cada card', async () => {
    mockChamarApi.mockImplementation(apiFalsa(rotasVazias('')))
    renderizar(acesso({}))
    expect(await within(card(/compromissos de hoje/i)).findByText(/nenhum compromisso hoje/i)).toHaveTextContent(/abra a agenda/i)
    expect(await within(card(/saúde/i)).findByText(/nenhuma medição/i)).toHaveTextContent(/registre/i)
    expect(await within(card(/medicamentos/i)).findByText(/nenhum medicamento ativo/i)).toHaveTextContent(/cadastre/i)
  })

  it('erro em uma rota: mensagem fixa só naquele card, sem texto técnico', async () => {
    mockChamarApi.mockImplementation(
      apiFalsa({
        ...rotasVazias(''),
        'GET /saude': () => {
          throw erroApi(500, 'detalhe interno do servidor')
        },
      }),
    )
    renderizar(acesso({}))
    const alerta = await within(card(/saúde/i)).findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar agora. Tente de novo mais tarde.')
    expect(alerta).not.toHaveTextContent(/500|interno/)
    expect(await within(card(/compromissos de hoje/i)).findByText(/nenhum compromisso hoje/i)).toBeInTheDocument()
  })

  it('carregando: cada card avisa que está carregando', () => {
    mockChamarApi.mockReturnValue(new Promise(() => {}))
    renderizar(acesso({}))
    expect(within(card(/compromissos de hoje/i)).getByRole('status')).toHaveTextContent(/carregando/i)
  })
})

describe('ResumoDia: cuidador e familiar', () => {
  it('cuidador sem permissão: dados do idoso escolhido, sem sugerir o que daria 403', async () => {
    mockChamarApi.mockImplementation(apiFalsa(rotasVazias('/idoso/7')))
    renderizar(acesso({ tipoPerfil: 'cuidador', temVinculoAprovado: true, vinculos: [vinculo({})] }))

    expect(screen.getByLabelText(/ver o resumo de/i)).toHaveValue('7')
    const agenda = await within(card(/compromissos de hoje/i)).findByText(/nenhum compromisso hoje/i)
    expect(agenda).not.toHaveTextContent(/abra a agenda/i)
    expect(await within(card(/saúde/i)).findByText(/nenhuma medição/i)).not.toHaveTextContent(/registre/i)
    expect(await within(card(/medicamentos/i)).findByText(/nenhum medicamento ativo/i)).not.toHaveTextContent(/cadastre/i)
  })

  it('cuidador com permissão: sugere registrar saúde e marcar compromisso, nunca cadastrar medicamento', async () => {
    mockChamarApi.mockImplementation(apiFalsa(rotasVazias('/idoso/7')))
    renderizar(
      acesso({ tipoPerfil: 'cuidador', temVinculoAprovado: true, vinculos: [vinculo({ permissoes: permissoesCuidador(true) })] }),
    )
    expect(await within(card(/compromissos de hoje/i)).findByText(/nenhum compromisso hoje/i)).toHaveTextContent(/abra a agenda/i)
    expect(await within(card(/saúde/i)).findByText(/nenhuma medição/i)).toHaveTextContent(/registre/i)
    expect(await within(card(/medicamentos/i)).findByText(/nenhum medicamento ativo/i)).not.toHaveTextContent(/cadastre/i)
  })

  it('familiar que decide pelo idoso: usa as rotas do idoso escolhido e sugere ações', async () => {
    mockChamarApi.mockImplementation(apiFalsa(rotasVazias('/idoso/7')))
    renderizar(
      acesso({
        tipoPerfil: 'familiar',
        temVinculoAprovado: true,
        vinculos: [vinculo({ tipo_vinculo: 'familiar', permissoes: null, decisao: { modo: 'familiar', transferencia: null } })],
      }),
    )
    expect(await within(card(/medicamentos/i)).findByText(/nenhum medicamento ativo/i)).toHaveTextContent(/cadastre/i)
    expect(mockChamarApi).toHaveBeenCalledWith('/agenda/idoso/7', expect.anything())
  })
})

describe('Home sem vínculo', () => {
  it('mostra o CartaoSemVinculo e nenhum card de dado, sem chamar a API', () => {
    renderizar(acesso({ tipoPerfil: 'cuidador', vinculos: [] }), <Home />)
    expect(screen.getByRole('heading', { name: /vincule-se a um idoso/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /resumo do dia/i })).not.toBeInTheDocument()
    expect(mockChamarApi).not.toHaveBeenCalled()
  })
})
