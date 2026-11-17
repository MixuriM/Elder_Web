import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HistoricoSaude from './HistoricoSaude'
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

type Registro = {
  id: number
  registrado_por_id: number
  tipo_medicao: string
  valor_1: number
  valor_2: number | null
  unidade: string
  data_hora: string
  observacoes: string | null
}

const REGISTRO: Registro = {
  id: 7,
  registrado_por_id: 50,
  tipo_medicao: 'pressao',
  valor_1: 120,
  valor_2: 80,
  unidade: 'mmHg',
  data_hora: '2026-09-24T12:00:00.000Z',
  observacoes: 'obs de teste',
}

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
    .map(([url, o]) => ({ url: String(url).replace(/^.*?(\/saude)/, '$1'), body: o?.body ? JSON.parse(o.body) : undefined }))
}

function vinculo(tipo: 'familiar' | 'cuidador', idosoId: number, extra: object = {}) {
  return {
    id: idosoId,
    tipo_vinculo: tipo,
    status: 'aprovado',
    papel_do_chamador: 'vinculado',
    idoso: { id: idosoId, nome: 'Idoso', email_mascarado: null },
    vinculado: { id: 50, nome: 'Eu', email_mascarado: null },
    ...extra,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  registros = [{ ...REGISTRO }]
  falhas = {}
  mockUseIdosos.mockReturnValue(listaPerfilIdoso)
  mockUseAcesso.mockReturnValue({ tipoPerfil: 'idoso', vinculos: [] })

  fetchMock.mockImplementation((url: string, opcoes: RequestInit = {}) => {
    const metodo = opcoes.method ?? 'GET'
    const chave = `${metodo} ${String(url).replace(/^.*?(\/saude)/, '$1')}`
    if (falhas[metodo]) return Promise.resolve(resposta(falhas[metodo], { error: 'TEXTO SENSIVEL DO SERVIDOR' }))
    if (metodo === 'GET') return Promise.resolve(resposta(200, { registros }))
    if (metodo === 'PATCH') return Promise.resolve(resposta(200, { ...registros[0] }))
    if (metodo === 'DELETE') {
      registros = []
      return Promise.resolve(resposta(204))
    }
    throw new Error(`chamada inesperada ${chave}`)
  })
  global.fetch = fetchMock
})

describe('HistoricoSaude — carrega sozinho', () => {
  it('idoso: busca GET /saude ao abrir, sem botão "Ver histórico" nem seletor', async () => {
    render(<HistoricoSaude />)

    expect(await screen.findByText('pressao')).toBeInTheDocument()
    expect(chamadas('GET').map((c) => c.url)).toEqual(['/saude'])
    expect(screen.queryByRole('button', { name: /ver histórico/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Idoso')).not.toBeInTheDocument()
  })

  it('mostra o estado carregando e depois o vazio', async () => {
    registros = []
    render(<HistoricoSaude />)

    expect(screen.getByRole('status')).toHaveTextContent(/carregando o histórico/i)
    expect(await screen.findByText('Nenhum registro de saúde')).toBeInTheDocument()
  })

  it('erro de carga: alerta fixo, sem ecoar o corpo do servidor', async () => {
    falhas.GET = 403
    render(<HistoricoSaude />)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Você não tem permissão para ver este histórico de saúde.')
    expect(alerta).not.toHaveTextContent('TEXTO SENSIVEL')
  })

  it('familiar: sem idoso escolhido mostra o convite e não chama a API; ao escolher, carrega', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoSaude />)

    expect(screen.getByText('Escolha um idoso para ver o histórico.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Idoso'), '8')

    expect(await screen.findByText('pressao')).toBeInTheDocument()
    expect(chamadas('GET').map((c) => c.url)).toEqual(['/saude/idoso/8'])
    expect(screen.queryByText('Escolha um idoso para ver o histórico.')).not.toBeInTheDocument()
  })

  it('sem idosos vinculados não busca nem mostra o convite', () => {
    mockUseIdosos.mockReturnValue({ ...listaSemIdosos, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: [] })
    render(<HistoricoSaude />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Escolha um idoso para ver o histórico.')).not.toBeInTheDocument()
  })

  it('trocar de idoso recarrega pelo caminho do novo idoso', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoSaude />)

    await user.selectOptions(screen.getByLabelText('Idoso'), '5')
    await screen.findByText('pressao')
    await user.selectOptions(screen.getByLabelText('Idoso'), '8')

    await waitFor(() => expect(chamadas('GET').map((c) => c.url)).toEqual(['/saude/idoso/5', '/saude/idoso/8']))
  })

  it('nova versão vinda da tela pai recarrega a lista', async () => {
    const { rerender } = render(<HistoricoSaude versao={0} />)
    await screen.findByText('pressao')

    registros = [{ ...REGISTRO }, { ...REGISTRO, id: 8, tipo_medicao: 'glicemia' }]
    rerender(<HistoricoSaude versao={1} />)

    expect(await screen.findByText('glicemia')).toBeInTheDocument()
  })
})

describe('HistoricoSaude — quem vê Editar e Remover', () => {
  async function botoes() {
    await screen.findByText('pressao')
    return {
      editar: screen.queryByRole('button', { name: 'Editar registro de pressao' }),
      remover: screen.queryByRole('button', { name: 'Remover registro de pressao' }),
    }
  }

  it('idoso vê os dois, com texto visível', async () => {
    render(<HistoricoSaude />)

    const { editar, remover } = await botoes()
    expect(editar).toHaveTextContent('Editar')
    expect(remover).toHaveTextContent('Remover')
  })

  it('familiar com modo familiar no idoso escolhido vê', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({
      tipoPerfil: 'familiar',
      vinculos: [vinculo('familiar', 5, { decisao: { modo: 'familiar', transferencia: null } })],
    })
    render(<HistoricoSaude />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')

    const { editar, remover } = await botoes()
    expect(editar).toBeInTheDocument()
    expect(remover).toBeInTheDocument()
  })

  it('familiar com modo idoso não vê', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({
      tipoPerfil: 'familiar',
      vinculos: [vinculo('familiar', 5, { decisao: { modo: 'idoso', transferencia: null } })],
    })
    render(<HistoricoSaude />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')

    const { editar, remover } = await botoes()
    expect(editar).not.toBeInTheDocument()
    expect(remover).not.toBeInTheDocument()
  })

  it('cuidador sem permissão de registrar saúde não vê', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'cuidador' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'cuidador', vinculos: [vinculo('cuidador', 5)] })
    render(<HistoricoSaude escritaTerceiros={false} />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')

    const { editar, remover } = await botoes()
    expect(editar).not.toBeInTheDocument()
    expect(remover).not.toBeInTheDocument()
  })

  it('cuidador com permissão vê só nos registros que ele mesmo criou', async () => {
    const user = userEvent.setup()
    registros = [
      { ...REGISTRO, id: 7, tipo_medicao: 'pressao', registrado_por_id: 50 },
      { ...REGISTRO, id: 8, tipo_medicao: 'glicemia', registrado_por_id: 99 },
    ]
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'cuidador' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'cuidador', vinculos: [vinculo('cuidador', 5)] })
    render(<HistoricoSaude escritaTerceiros />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')

    await screen.findByText('glicemia')
    expect(screen.getByRole('button', { name: 'Editar registro de pressao' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar registro de glicemia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover registro de glicemia' })).not.toBeInTheDocument()
  })

  it('vínculos não carregados: mostra (falha abre; o 403 do servidor é a barreira)', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoSaude />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')

    const { editar } = await botoes()
    expect(editar).toBeInTheDocument()
  })
})

describe('HistoricoSaude — editar', () => {
  async function abrirEdicao(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Editar registro de pressao' }))
    return screen.getByRole('dialog', { name: 'Editar registro' })
  }

  it('abre modal com os campos preenchidos; Cancelar fecha sem chamar a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)

    const dialogo = await abrirEdicao(user)

    expect(within(dialogo).getByLabelText('Tipo de medição')).toHaveValue('pressao')
    expect(within(dialogo).getByLabelText('Valor 1')).toHaveValue('120')
    expect(within(dialogo).getByLabelText('Valor 2 (opcional)')).toHaveValue('80')
    expect(within(dialogo).getByLabelText('Unidade')).toHaveValue('mmHg')
    expect(within(dialogo).getByLabelText('Observações (opcional)')).toHaveValue('obs de teste')

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas('PATCH')).toHaveLength(0)
  })

  it('valor inválido: mensagem no modal, sem chamar a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)
    const dialogo = await abrirEdicao(user)

    await user.clear(within(dialogo).getByLabelText('Valor 1'))
    await user.type(within(dialogo).getByLabelText('Valor 1'), '1,234')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(
      'Informe valores entre 0 e 9999,99, com até duas casas decimais.',
    )
    expect(chamadas('PATCH')).toHaveLength(0)
  })

  it('tipo em branco: pede para conferir os campos', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)
    const dialogo = await abrirEdicao(user)

    await user.clear(within(dialogo).getByLabelText('Tipo de medição'))
    // required do navegador não bloqueia no jsdom ao clicar; a validação do código é a que vale.
    dialogo.querySelector('form')?.setAttribute('novalidate', '')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Confira os campos de medição, unidade e observações.')
    expect(chamadas('PATCH')).toHaveLength(0)
  })

  it('idoso salva: PATCH /saude/:id, fecha o modal, avisa e recarrega a lista', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)
    const dialogo = await abrirEdicao(user)

    await user.clear(within(dialogo).getByLabelText('Valor 1'))
    await user.type(within(dialogo).getByLabelText('Valor 1'), '130')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(chamadas('PATCH')).toEqual([
      {
        url: '/saude/7',
        body: {
          tipo_medicao: 'pressao',
          valor_1: 130,
          valor_2: 80,
          unidade: 'mmHg',
          data_hora: '2026-09-24T12:00:00.000Z',
          observacoes: 'obs de teste',
        },
      },
    ])
    expect(screen.getByRole('status')).toHaveTextContent('Registro de saúde atualizado com sucesso!')
    await waitFor(() => expect(chamadas('GET')).toHaveLength(2))
  })

  it('familiar salva pelo caminho do idoso escolhido', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoSaude />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '5')
    const dialogo = await abrirEdicao(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(chamadas('PATCH')[0]?.url).toBe('/saude/idoso/5/7'))
  })

  it('erro do servidor: mensagem fixa dentro do modal, modal segue aberto e habilitado', async () => {
    const user = userEvent.setup()
    falhas.PATCH = 403
    render(<HistoricoSaude />)
    const dialogo = await abrirEdicao(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    const alerta = await within(dialogo).findByRole('alert')
    expect(alerta).toHaveTextContent('Você não tem permissão para alterar este registro.')
    expect(alerta).not.toHaveTextContent('TEXTO SENSIVEL')
    expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
    expect(within(dialogo).getByLabelText('Valor 1')).toBeEnabled()
  })

  it('enquanto salva: campos e botões desabilitados', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string, o: RequestInit = {}) =>
      o.method === 'PATCH'
        ? new Promise((r) => (liberar = () => r(resposta(200, { ...REGISTRO }))))
        : original(url, o),
    )
    render(<HistoricoSaude />)
    const dialogo = await abrirEdicao(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(within(dialogo).getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(dialogo).getByLabelText('Valor 1')).toBeDisabled()

    liberar()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('HistoricoSaude — remover', () => {
  it('pede confirmação; Cancelar não chama a API', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)

    await user.click(await screen.findByRole('button', { name: 'Remover registro de pressao' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Remover este registro? Esta ação não pode ser desfeita.')

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(chamadas('DELETE')).toHaveLength(0)
  })

  it('confirmar: DELETE /saude/:id, fecha, recarrega e avisa', async () => {
    const user = userEvent.setup()
    render(<HistoricoSaude />)

    await user.click(await screen.findByRole('button', { name: 'Remover registro de pressao' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(chamadas('DELETE').map((c) => c.url)).toEqual(['/saude/7'])
    expect(await screen.findByText('Nenhum registro de saúde')).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((s) => /registro removido/i.test(s.textContent ?? ''))).toBe(true)
  })

  it('familiar remove pelo caminho do idoso escolhido', async () => {
    const user = userEvent.setup()
    mockUseIdosos.mockReturnValue({ ...listaFamiliar, tipoPerfil: 'familiar' })
    mockUseAcesso.mockReturnValue({ tipoPerfil: 'familiar', vinculos: null })
    render(<HistoricoSaude />)
    await user.selectOptions(screen.getByLabelText('Idoso'), '8')

    await user.click(await screen.findByRole('button', { name: 'Remover registro de pressao' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(chamadas('DELETE').map((c) => c.url)).toEqual(['/saude/idoso/8/7']))
  })

  it('404: mensagem fixa dentro da confirmação, que segue aberta', async () => {
    const user = userEvent.setup()
    falhas.DELETE = 404
    render(<HistoricoSaude />)

    await user.click(await screen.findByRole('button', { name: 'Remover registro de pressao' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))

    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent(
      'Este registro já foi removido. Feche e atualize a lista.',
    )
  })
})

describe('HistoricoSaude — cartão do registro e lista vazia', () => {
  it('não mostra o número de identificação (#id) do registro', async () => {
    render(<HistoricoSaude />)

    await screen.findByText('pressao')
    expect(screen.queryByText('#7')).not.toBeInTheDocument()
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument()
  })

  it('lista vazia com onAdicionar: cartão com título, texto e botão Registrar leitura que chama onAdicionar', async () => {
    const user = userEvent.setup()
    const onAdicionar = jest.fn()
    registros = []
    render(<HistoricoSaude onAdicionar={onAdicionar} />)

    const titulo = await screen.findByText('Nenhum registro de saúde')
    const cartao = titulo.closest('section') as HTMLElement
    expect(cartao).toHaveAttribute('role', 'status')
    expect(within(cartao).getByText(/registre a primeira medição/i)).toBeInTheDocument()

    await user.click(within(cartao).getByRole('button', { name: 'Registrar leitura' }))

    expect(onAdicionar).toHaveBeenCalledTimes(1)
  })

  it('lista vazia sem onAdicionar (quem não registra): sem botão e com texto de leitura', async () => {
    registros = []
    render(<HistoricoSaude />)

    await screen.findByText('Nenhum registro de saúde')
    expect(screen.queryByRole('button', { name: 'Registrar leitura' })).not.toBeInTheDocument()
    expect(screen.getByText(/quando uma medição for registrada/i)).toBeInTheDocument()
  })
})
