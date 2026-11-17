import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HistoricoAlimentar from './HistoricoAlimentar'
import { listaFamiliar, listaPerfilIdoso, listaSemIdosos } from '../../hooks/idososFixtures'
import type { IdososVinculados } from '../../hooks/useIdososVinculados'

// Dados obviamente falsos, só de teste.
const mockUseIdosos = jest.fn()
const mockUseAcesso = jest.fn()

jest.mock('../../hooks/useIdososVinculados', () => ({ useIdososVinculados: () => mockUseIdosos() }))
jest.mock('../../contexts/useAcesso', () => ({ useAcesso: () => mockUseAcesso() }))
jest.mock('../../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

// Seletor simples, sem pré-seleção automática: o comportamento real dele tem teste próprio.
jest.mock('../common/SeletorIdoso', () => ({
  __esModule: true,
  default: ({
    id,
    valor,
    aoMudar,
    lista,
  }: {
    id: string
    valor: string
    aoMudar: (v: string) => void
    lista: IdososVinculados
  }) =>
    lista.ehIdoso ? null : (
      <>
        <label htmlFor={id}>Idoso</label>
        <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">--</option>
          {lista.idosos.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.nome}
            </option>
          ))}
        </select>
      </>
    ),
}))

type Registro = { id: number; refeicao: string; descricao: string; data_hora: string }

const REGISTRO: Registro = { id: 7, refeicao: 'almoco', descricao: 'arroz e feijão de teste', data_hora: '2026-10-15T15:30:00.000Z' }

function resposta(status: number, corpo: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (corpo === null ? Promise.reject(new Error('sem corpo')) : Promise.resolve(corpo)),
  } as Response
}

let registros: Registro[]
let falhas: Record<string, number>
const fetchMock = jest.fn()

function chamadas(metodo: string) {
  return fetchMock.mock.calls
    .filter(([, o]) => (o?.method ?? 'GET') === metodo)
    .map(([url, o]) => ({ url: String(url).replace(/^.*?(\/alimentacao)/, '$1'), body: o?.body ? JSON.parse(o.body) : undefined }))
}

function vinculoFamiliar(idosoId: number, modo?: 'idoso' | 'familiar') {
  return {
    id: idosoId,
    tipo_vinculo: 'familiar',
    status: 'aprovado',
    papel_do_chamador: 'vinculado',
    idoso: { id: idosoId, nome: 'Idoso', email_mascarado: null },
    vinculado: { id: 50, nome: 'Eu', email_mascarado: null },
    decisao: modo ? { modo, transferencia: null } : undefined,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  registros = [{ ...REGISTRO }]
  falhas = {}
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'idoso', vinculos: [] })

  fetchMock.mockImplementation((_url: string, opcoes: RequestInit = {}) => {
    const metodo = opcoes.method ?? 'GET'
    if (falhas[metodo]) return Promise.resolve(resposta(falhas[metodo], { error: 'TEXTO SENSIVEL DO SERVIDOR' }))
    if (metodo === 'GET') return Promise.resolve(resposta(200, { registros }))
    if (metodo === 'PATCH') return Promise.resolve(resposta(200, { ...registros[0] }))
    if (metodo === 'DELETE') {
      registros = []
      return Promise.resolve(resposta(204))
    }
    throw new Error(`chamada inesperada ${metodo}`)
  })
  global.fetch = fetchMock
})

describe('HistoricoAlimentar — carrega sozinho', () => {
  it('idoso: GET /alimentacao ao abrir, com rótulo, data de São Paulo e descrição; sem botão nem seletor', async () => {
    render(<HistoricoAlimentar />)

    expect(await screen.findByText('Almoço')).toBeInTheDocument()
    expect(screen.getByText('15/10/2026 12:30')).toBeInTheDocument()
    expect(screen.getByText('arroz e feijão de teste')).toBeInTheDocument()
    expect(chamadas('GET').map((c) => c.url)).toEqual(['/alimentacao'])
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Idoso')).not.toBeInTheDocument()
  })

  it('carregando e depois vazio', async () => {
    registros = []
    render(<HistoricoAlimentar />)

    expect(screen.getByRole('status')).toHaveTextContent(/carregando o histórico alimentar/i)
    expect(await screen.findByText('Nenhuma refeição registrada')).toBeInTheDocument()
  })

  it('erro de carga: mensagem fixa, sem ecoar o corpo', async () => {
    falhas.GET = 403
    render(<HistoricoAlimentar />)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Você não tem permissão para ver este histórico alimentar.')
    expect(alerta).not.toHaveTextContent('TEXTO SENSIVEL')
  })

  it('registro com refeição desconhecida vira erro: nunca lista pela metade', async () => {
    registros = [{ ...REGISTRO }, { ...REGISTRO, id: 8, refeicao: 'inventada' }]
    render(<HistoricoAlimentar />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exibir o histórico alimentar.')
    expect(screen.queryByText('Almoço')).not.toBeInTheDocument()
  })

  it('familiar: sem idoso escolhido mostra o convite; ao escolher, carrega pelo caminho do idoso', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoAlimentar />)

    expect(screen.getByText('Escolha um idoso para ver o histórico.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Idoso'), '8')

    expect(await screen.findByText('Almoço')).toBeInTheDocument()
    expect(chamadas('GET').map((c) => c.url)).toEqual(['/alimentacao/idoso/8'])
  })

  it('sem idosos vinculados: não busca', () => {
    mockUseIdosos.mockReturnValue({ ...listaSemIdosos, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: [] })
    render(<HistoricoAlimentar />)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nova versão da tela pai recarrega', async () => {
    const { rerender } = render(<HistoricoAlimentar versao={0} />)
    await screen.findByText('Almoço')

    registros = [{ ...REGISTRO }, { ...REGISTRO, id: 8, refeicao: 'jantar', descricao: 'sopa de teste' }]
    rerender(<HistoricoAlimentar versao={1} />)

    expect(await screen.findByText('sopa de teste')).toBeInTheDocument()
  })
})

describe('HistoricoAlimentar — quem vê Editar e Remover', () => {
  it('idoso vê, com nome acessível pelo item', async () => {
    render(<HistoricoAlimentar />)

    expect(await screen.findByRole('button', { name: 'Editar refeição Almoço' })).toHaveTextContent('Editar')
    expect(screen.getByRole('button', { name: 'Remover refeição Almoço' })).toHaveTextContent('Remover')
  })

  it.each([
    ['familiar com modo familiar', 'familiar', true],
    ['familiar com modo idoso', 'idoso', false],
  ] as const)('%s', async (_nome, modo, ve) => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: [vinculoFamiliar(5, modo)] })
    render(<HistoricoAlimentar />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')
    await screen.findByText('Almoço')

    expect(!!screen.queryByRole('button', { name: 'Editar refeição Almoço' })).toBe(ve)
    expect(!!screen.queryByRole('button', { name: 'Remover refeição Almoço' })).toBe(ve)
  })

  it('cuidador nunca vê', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'cuidador' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'cuidador', vinculos: null })
    render(<HistoricoAlimentar />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')
    await screen.findByText('Almoço')

    expect(screen.queryByRole('button', { name: /editar refeição/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remover refeição/i })).not.toBeInTheDocument()
  })
})

describe('HistoricoAlimentar — editar', () => {
  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Editar refeição Almoço' }))
    return screen.getByRole('dialog', { name: 'Editar refeição' })
  }

  it('abre com os campos preenchidos e as 6 refeições; Cancelar fecha sem chamar a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)

    const dialogo = await abrir(user)

    expect(within(dialogo).getByLabelText('Refeição')).toHaveValue('almoco')
    expect(within(dialogo).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Café da manhã',
      'Lanche da manhã',
      'Almoço',
      'Lanche da tarde',
      'Jantar',
      'Ceia',
    ])
    expect(within(dialogo).getByLabelText('Descrição')).toHaveValue('arroz e feijão de teste')

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas('PATCH')).toHaveLength(0)
  })

  it('descrição em branco: avisa no modal, sem chamar a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)
    const dialogo = await abrir(user)

    await user.clear(within(dialogo).getByLabelText('Descrição'))
    dialogo.querySelector('form')?.setAttribute('novalidate', '')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Descreva o que foi comido.')
    expect(chamadas('PATCH')).toHaveLength(0)
  })

  it('salva: PATCH /alimentacao/:id só com refeição, descrição e data; fecha, avisa e recarrega', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)
    const dialogo = await abrir(user)

    await user.selectOptions(within(dialogo).getByLabelText('Refeição'), 'jantar')
    await user.clear(within(dialogo).getByLabelText('Descrição'))
    await user.type(within(dialogo).getByLabelText('Descrição'), 'sopa de teste')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [patch] = chamadas('PATCH')
    expect(patch.url).toBe('/alimentacao/7')
    expect(Object.keys(patch.body).sort()).toEqual(['data_hora', 'descricao', 'refeicao'])
    expect(patch.body).toMatchObject({ refeicao: 'jantar', descricao: 'sopa de teste' })
    expect(screen.getByText('Refeição atualizada.').closest('[role="status"]')).not.toBeNull()
    await waitFor(() => expect(chamadas('GET')).toHaveLength(2))
  })

  it('familiar salva pelo caminho do idoso escolhido', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoAlimentar />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '8')
    const dialogo = await abrir(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(chamadas('PATCH')[0]?.url).toBe('/alimentacao/idoso/8/7'))
  })

  it('erro do servidor: mensagem fixa no modal, que segue aberto', async () => {
    const user = userEvent.setup()
    falhas.PATCH = 403
    render(<HistoricoAlimentar />)
    const dialogo = await abrir(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    const alerta = await within(dialogo).findByRole('alert')
    expect(alerta).toHaveTextContent('Você não tem permissão para alterar este registro.')
    expect(alerta).not.toHaveTextContent('TEXTO SENSIVEL')
    expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
  })

  it('enquanto salva: campos e botões desabilitados', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string, o: RequestInit = {}) =>
      o.method === 'PATCH' ? new Promise((r) => (liberar = () => r(resposta(200, { ...REGISTRO })))) : original(url, o),
    )
    render(<HistoricoAlimentar />)
    const dialogo = await abrir(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(within(dialogo).getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(dialogo).getByLabelText('Descrição')).toBeDisabled()
    expect(within(dialogo).getByLabelText('Refeição')).toBeDisabled()

    liberar()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('HistoricoAlimentar — remover', () => {
  it('Cancelar não chama a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)

    await user.click(await screen.findByRole('button', { name: 'Remover refeição Almoço' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Remover este registro? Esta ação não pode ser desfeita.')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(chamadas('DELETE')).toHaveLength(0)
  })

  it('confirmar: DELETE /alimentacao/:id, fecha, recarrega e avisa', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)

    await user.click(await screen.findByRole('button', { name: 'Remover refeição Almoço' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(chamadas('DELETE').map((c) => c.url)).toEqual(['/alimentacao/7'])
    expect(await screen.findByText('Nenhuma refeição registrada')).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((s) => /refeição removida/i.test(s.textContent ?? ''))).toBe(true)
  })

  it('familiar remove pelo caminho do idoso escolhido', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoAlimentar />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '8')

    await user.click(await screen.findByRole('button', { name: 'Remover refeição Almoço' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(chamadas('DELETE').map((c) => c.url)).toEqual(['/alimentacao/idoso/8/7']))
  })

  it('404: mensagem fixa na confirmação, que segue aberta', async () => {
    const user = userEvent.setup()
    falhas.DELETE = 404
    render(<HistoricoAlimentar />)

    await user.click(await screen.findByRole('button', { name: 'Remover refeição Almoço' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent(
      'Este registro já foi removido. Feche e atualize a lista.',
    )
  })
})

describe('HistoricoAlimentar — mensagens fixas e privacidade', () => {
  it.each([
    [400, 'Id de idoso inválido.'],
    [401, 'Sessão expirada. Entre novamente.'],
    [403, 'Você não tem permissão para ver este histórico alimentar.'],
    [404, 'Não foi possível carregar o histórico alimentar.'],
    [500, 'Não foi possível carregar o histórico alimentar.'],
    [503, 'Não foi possível carregar o histórico alimentar.'],
  ])('GET com status %i mostra a mensagem fixa e nunca o corpo do servidor', async (status, mensagem) => {
    falhas.GET = status
    render(<HistoricoAlimentar />)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).not.toHaveTextContent('TEXTO SENSIVEL')
  })

  it('nunca loga descrição nem refeição em console.*, nem no erro de edição', async () => {
    const user = userEvent.setup()
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      falhas.PATCH = 500
      render(<HistoricoAlimentar />)

      await user.click(await screen.findByRole('button', { name: 'Editar refeição Almoço' }))
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      await screen.findByText('Não foi possível salvar as alterações.')

      const logado = JSON.stringify(espioes.map((s) => s.mock.calls))
      expect(logado).not.toContain('arroz e feijão de teste')
      expect(logado).not.toContain('almoco')
    } finally {
      espioes.forEach((s) => s.mockRestore())
    }
  })
})

describe('HistoricoAlimentar — lista vazia', () => {
  it('com onAdicionar: cartão com título, texto e botão Registrar refeição que chama onAdicionar', async () => {
    const user = userEvent.setup()
    const onAdicionar = jest.fn()
    registros = []
    render(<HistoricoAlimentar onAdicionar={onAdicionar} />)

    const titulo = await screen.findByText('Nenhuma refeição registrada')
    const cartao = titulo.closest('section') as HTMLElement
    expect(cartao).toHaveAttribute('role', 'status')
    expect(within(cartao).getByText(/registre a primeira refeição/i)).toBeInTheDocument()

    await user.click(within(cartao).getByRole('button', { name: 'Registrar refeição' }))

    expect(onAdicionar).toHaveBeenCalledTimes(1)
  })

  it('sem onAdicionar (cuidador): sem botão e com texto de leitura', async () => {
    registros = []
    render(<HistoricoAlimentar />)

    await screen.findByText('Nenhuma refeição registrada')
    expect(screen.queryByRole('button', { name: 'Registrar refeição' })).not.toBeInTheDocument()
    expect(screen.getByText(/quando uma refeição for registrada/i)).toBeInTheDocument()
  })

  it('com registros não mostra o cartão de lista vazia', async () => {
    render(<HistoricoAlimentar onAdicionar={jest.fn()} />)

    await screen.findByText('Almoço')
    expect(screen.queryByText('Nenhuma refeição registrada')).not.toBeInTheDocument()
  })
})
