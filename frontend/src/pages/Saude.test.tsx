import '@testing-library/jest-dom'

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import { MemoryRouter } from 'react-router-dom'

import Saude from './Saude'

import * as permissoesSaude from '../lib/permissoesSaude'

import {
  listaFamiliar,
  listaPerfilIdoso,
  listaSemIdosos,
} from '../hooks/idososFixtures'

/* =========================================================
   MOCK DAS PERMISSÕES
========================================================= */

jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: jest.fn(),
}))

const mockUsePermissoes =
  permissoesSaude.usePermissoesSaude as jest.Mock

/* =========================================================
   MOCK DOS IDOSOS VINCULADOS
========================================================= */

const mockUseIdosos = jest.fn()

jest.mock('../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => mockUseIdosos(),
}))

/* =========================================================
   MOCK DO BOTÃO DE TEMA
========================================================= */

jest.mock('../components/layout/BotaoTema', () => {
  return function BotaoTemaMock() {
    return (
      <button type="button">
        Alterar tema
      </button>
    )
  }
})

/* =========================================================
   AUTH
========================================================= */

const mockGetCurrentUserToken = jest.fn()

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) =>
    mockGetCurrentUserToken(...args),
}))

/* =========================================================
   RESPOSTA MOCK
========================================================= */

function respostaJson(
  status: number,
  corpo: unknown,
) {
  return {
    ok: status >= 200 && status < 300,
    status,

    json: () =>
      Promise.resolve(corpo),
  } as Response
}

/* =========================================================
   CONFIGURAÇÃO PADRÃO
========================================================= */

beforeEach(() => {
  jest.clearAllMocks()

  mockUseIdosos.mockReturnValue(listaFamiliar)

  mockUsePermissoes.mockReturnValue({
    estado: 'ok',
    escrita: true,
    avisoSemFlag: false,
  })

  mockGetCurrentUserToken.mockResolvedValue(
    'token-fake',
  )

  global.fetch = jest.fn()
})

/* =========================================================
   ESTRUTURA DA PÁGINA
========================================================= */

describe('Saude — estrutura da página', () => {
  it('renderiza o título principal', () => {
    render(<Saude />)

    expect(
      screen.getByRole('heading', {
        name: /minha saúde/i,
        level: 1,
      }),
    ).toBeInTheDocument()
  })

  it('renderiza a descrição principal', () => {
    render(<Saude />)

    expect(
      screen.getByText(
        /registre, acompanhe e mantenha suas informações/i,
      ),
    ).toBeInTheDocument()
  })

  it('renderiza botão voltar', () => {
    render(<Saude />)

    expect(
      screen.getByRole('button', {
        name: /voltar/i,
      }),
    ).toBeInTheDocument()
  })

  it('renderiza botão de tema', () => {
    render(<Saude />)

    expect(
      screen.getByRole('button', {
        name: /alterar tema/i,
      }),
    ).toBeInTheDocument()
  })

  it('renderiza os principais cards', () => {
    render(<Saude />)

    expect(
      screen.getByRole('heading', {
        name: /registrar leitura de saúde/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: /registrar saúde do idoso/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: /histórico de saúde/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: /editar meu registro/i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: /editar registro do idoso/i,
      }),
    ).toBeInTheDocument()
  })
})

/* =========================================================
   REGISTRAR MINHA SAÚDE
========================================================= */

describe(
  'Saude — registrar minha saúde',
  () => {
    function campos() {
      const titulo =
        screen.getByRole('heading', {
          name: /registrar leitura de saúde/i,
        })

      const section =
        titulo.closest('section')

      if (!section) {
        throw new Error(
          'Seção de registro próprio não encontrada.',
        )
      }

      const secao = within(section)

      return {
        tipo:
          secao.getByLabelText(
            'Tipo de medição',
            {
              exact: true,
            },
          ),

        valor1:
          secao.getByLabelText(
            'Valor 1',
            {
              exact: true,
            },
          ),

        valor2:
          secao.getByLabelText(
            'Valor 2 (opcional)',
            {
              exact: true,
            },
          ),

        unidade:
          secao.getByLabelText(
            'Unidade',
            {
              exact: true,
            },
          ),

        dataHora:
          secao.getByLabelText(
            'Data e hora (opcional)',
            {
              exact: true,
            },
          ),

        observacoes:
          secao.getByLabelText(
            'Observações (opcional)',
            {
              exact: true,
            },
          ),

        botao:
          secao.getByRole('button', {
            name: /^registrar leitura$/i,
          }),
      }
    }

    it('possui os campos acessíveis por label', () => {
      render(<Saude />)

      const c = campos()

      Object.values(c).forEach(
        (elemento) => {
          expect(
            elemento,
          ).toBeInTheDocument()
        },
      )
    })

    it(
      'envia POST /saude com valores numéricos',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(201, {
            id: 55,
          }),
        )

        const user = userEvent.setup()

        render(<Saude />)

        const c = campos()

        await user.type(
          c.tipo,
          'pressao',
        )

        await user.type(
          c.valor1,
          '120',
        )

        await user.type(
          c.valor2,
          '80',
        )

        await user.type(
          c.unidade,
          'mmHg',
        )

        fireEvent.change(
          c.dataHora,
          {
            target: {
              value:
                '2026-09-23T10:00',
            },
          },
        )

        await user.click(c.botao)

        await waitFor(() => {
          expect(
            global.fetch,
          ).toHaveBeenCalled()
        })

        const [
          url,
          opcoes,
        ] = (
          global.fetch as jest.Mock
        ).mock.calls[0]

        expect(url).toMatch(
          /\/saude$/,
        )

        expect(
          opcoes.method,
        ).toBe('POST')

        expect(
          opcoes.headers.Authorization,
        ).toBe(
          'Bearer token-fake',
        )

        const corpo =
          JSON.parse(opcoes.body)

        expect(
          corpo.tipo_medicao,
        ).toBe('pressao')

        expect(
          corpo.valor_1,
        ).toBe(120)

        expect(
          corpo.valor_2,
        ).toBe(80)

        expect(
          typeof corpo.valor_1,
        ).toBe('number')

        expect(
          corpo.data_hora,
        ).toBe(
          new Date(
            '2026-09-23T10:00',
          ).toISOString(),
        )

        expect(corpo).not
          .toHaveProperty(
            'idoso_id',
          )

        expect(corpo).not
          .toHaveProperty(
            'registrado_por_id',
          )

        expect(corpo).not
          .toHaveProperty(
            'editado_por_id',
          )
      },
    )

    it(
      'mostra mensagem de sucesso',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(201, {
            id: 55,
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const c = campos()

        await user.type(
          c.tipo,
          'peso',
        )

        await user.type(
          c.valor1,
          '70',
        )

        await user.type(
          c.unidade,
          'kg',
        )

        await user.click(
          c.botao,
        )

        expect(
          await screen.findByText(
            /leitura registrada com sucesso/i,
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'mostra erro do backend',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(400, {
            error:
              'valor_1 inválido.',
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const c = campos()

        await user.type(
          c.tipo,
          'peso',
        )

        await user.type(
          c.valor1,
          '70',
        )

        await user.type(
          c.unidade,
          'kg',
        )

        await user.click(
          c.botao,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'valor_1 inválido.',
        )
      },
    )
  },
)

/* =========================================================
   REGISTRAR SAÚDE DO IDOSO
========================================================= */

describe(
  'Saude — registrar saúde do idoso',
  () => {
    function secao() {
      const titulo =
        screen.getByRole(
          'heading',
          {
            name:
              /registrar saúde do idoso/i,
          },
        )

      const section =
        titulo.closest('section')

      if (!section) {
        throw new Error(
          'Seção do idoso não encontrada.',
        )
      }

      return within(section)
    }

    it(
      'renderiza os campos do idoso',
      () => {
        render(<Saude />)

        const s = secao()

        expect(
          s.getByLabelText(
            'Idoso',
          ),
        ).toBeInTheDocument()

        expect(
          s.getByLabelText(
            'Tipo de medição',
          ),
        ).toBeInTheDocument()

        expect(
          s.getByLabelText(
            'Valor 1',
          ),
        ).toBeInTheDocument()

        expect(
          s.getByLabelText(
            'Unidade',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'envia POST /saude/idoso/:id',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(201, {
            id: 77,
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const s = secao()

        await user.selectOptions(
          s.getByLabelText(
            'Idoso',
          ),
          '5',
        )

        await user.type(
          s.getByLabelText(
            'Tipo de medição',
          ),
          'glicemia',
        )

        await user.type(
          s.getByLabelText(
            'Valor 1',
          ),
          '95',
        )

        await user.type(
          s.getByLabelText(
            'Unidade',
          ),
          'mg/dL',
        )

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /registrar leitura do idoso/i,
            },
          ),
        )

        await waitFor(() => {
          expect(
            global.fetch,
          ).toHaveBeenCalled()
        })

        const [
          url,
          opcoes,
        ] = (
          global.fetch as jest.Mock
        ).mock.calls[0]

        expect(url).toMatch(
          /\/saude\/idoso\/5$/,
        )

        expect(
          opcoes.method,
        ).toBe('POST')

        const corpo =
          JSON.parse(opcoes.body)

        expect(
          corpo.valor_1,
        ).toBe(95)

        expect(corpo).not
          .toHaveProperty(
            'idoso_id',
          )
      },
    )
  },
)

/* =========================================================
   HISTÓRICO
========================================================= */

describe(
  'Saude — histórico',
  () => {
    function secao() {
      const titulo =
        screen.getByRole(
          'heading',
          {
            name:
              /histórico de saúde/i,
          },
        )

      const section =
        titulo.closest('section')

      if (!section) {
        throw new Error(
          'Histórico não encontrado.',
        )
      }

      return within(section)
    }

    it(
      'perfil idoso: sem seletor, chama GET /saude',
      async () => {
        mockUseIdosos.mockReturnValue(
          listaPerfilIdoso,
        );

        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(200, {
            registros: [
              {
                id: 7,
                tipo_medicao:
                  'pressao',

                valor_1: 120,
                valor_2: 80,
                unidade: 'mmHg',

                data_hora:
                  '2026-09-24T12:00:00.000Z',
              },
            ],
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const s = secao()

        expect(
          s.queryByRole('combobox'),
        ).not.toBeInTheDocument()

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /ver histórico/i,
            },
          ),
        )

        expect(
          await s.findByText(
            'pressao',
          ),
        ).toBeInTheDocument()

        const [
          url,
          opcoes,
        ] = (
          global.fetch as jest.Mock
        ).mock.calls[0]

        expect(url).toMatch(
          /\/saude$/,
        )

        expect(
          opcoes.method,
        ).toBe('GET')
      },
    )

    it(
      'escolhendo o idoso no seletor chama GET /saude/idoso/:id',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(200, {
            registros: [],
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const s = secao()

        await user.selectOptions(
          s.getByLabelText('Idoso'),
          '8',
        )

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /ver histórico/i,
            },
          ),
        )

        expect(
          await s.findByText(
            /nenhum registro encontrado/i,
          ),
        ).toBeInTheDocument()

        expect(
          (
            global.fetch as jest.Mock
          ).mock.calls[0][0],
        ).toMatch(
          /\/saude\/idoso\/8$/,
        )
      },
    )

    it(
      'primeiro idoso vem pré-selecionado e o ID não é exibido nem digitável',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(200, {
            registros: [],
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const s = secao()

        expect(
          s.getByLabelText('Idoso'),
        ).toHaveValue('5')

        expect(
          s.queryByLabelText(
            /ID do idoso/i,
          ),
        ).not.toBeInTheDocument()

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /ver histórico/i,
            },
          ),
        )

        await s.findByText(
          /nenhum registro encontrado/i,
        )

        expect(
          (
            global.fetch as jest.Mock
          ).mock.calls[0][0],
        ).toMatch(
          /\/saude\/idoso\/5$/,
        )
      },
    )

    it(
      'sem idosos vinculados: desabilita o envio e não chama a API',
      async () => {
        mockUseIdosos.mockReturnValue(
          listaSemIdosos,
        )

        const user =
          userEvent.setup()

        render(
          <MemoryRouter>
            <Saude />
          </MemoryRouter>,
        )

        const s = secao()

        const botao =
          s.getByRole(
            'button',
            {
              name:
                /ver histórico/i,
            },
          )

        expect(
          botao,
        ).toBeDisabled()

        await user.click(botao)

        expect(
          global.fetch,
        ).not.toHaveBeenCalled()
      },
    )
  },
)

/* =========================================================
   EDITAR REGISTRO PRÓPRIO
========================================================= */

describe(
  'Saude — editar registro próprio',
  () => {
    async function abrir() {
      const user =
        userEvent.setup()

      render(<Saude />)

      const titulo =
        screen.getByRole(
          'heading',
          {
            name:
              /editar meu registro/i,
          },
        )

      const section =
        titulo.closest('section')

      if (!section) {
        throw new Error(
          'Seção de edição não encontrada.',
        )
      }

      const s = within(section)

      await user.click(
        s.getByRole('button', {
          name:
            /editar meu registro/i,
        }),
      )

      return {
        user,
        s,
      }
    }

    it(
      'começa com formulário fechado',
      () => {
        render(<Saude />)

        expect(
          screen.queryByLabelText(
            'ID do registro',
          ),
        ).not.toBeInTheDocument()
      },
    )

    it(
      'abre o formulário ao clicar',
      async () => {
        const { s } =
          await abrir()

        expect(
          s.getByLabelText(
            'ID do registro',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'envia PATCH /saude/:id',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(200, {
            id: 9,
          }),
        )

        const {
          user,
          s,
        } = await abrir()

        await user.type(
          s.getByLabelText(
            'ID do registro',
          ),
          '9',
        )

        await user.type(
          s.getByLabelText(
            'Valor 1',
          ),
          '150',
        )

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /salvar alterações/i,
            },
          ),
        )

        await waitFor(() => {
          expect(
            global.fetch,
          ).toHaveBeenCalled()
        })

        const [
          url,
          opcoes,
        ] = (
          global.fetch as jest.Mock
        ).mock.calls[0]

        expect(url).toMatch(
          /\/saude\/9$/,
        )

        expect(
          opcoes.method,
        ).toBe('PATCH')

        expect(
          JSON.parse(
            opcoes.body,
          ),
        ).toEqual({
          valor_1: 150,
        })
      },
    )
  },
)

/* =========================================================
   EDITAR REGISTRO DO IDOSO
========================================================= */

describe(
  'Saude — editar registro do idoso',
  () => {
    it(
      'envia PATCH /saude/idoso/:idosoId/:id',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(200, {
            id: 9,
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const titulo =
          screen.getByRole(
            'heading',
            {
              name:
                /editar registro do idoso/i,
            },
          )

        const section =
          titulo.closest('section')

        if (!section) {
          throw new Error(
            'Seção de edição do idoso não encontrada.',
          )
        }

        const s =
          within(section)

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        )

        await user.selectOptions(
          s.getByLabelText(
            'Idoso',
          ),
          '5',
        )

        await user.type(
          s.getByLabelText(
            'ID do registro',
          ),
          '9',
        )

        await user.type(
          s.getByLabelText(
            'Valor 1',
          ),
          '130',
        )

        await user.click(
          s.getByRole(
            'button',
            {
              name:
                /salvar alterações/i,
            },
          ),
        )

        await waitFor(() => {
          expect(
            global.fetch,
          ).toHaveBeenCalled()
        })

        const [
          url,
          opcoes,
        ] = (
          global.fetch as jest.Mock
        ).mock.calls[0]

        expect(url).toMatch(
          /\/saude\/idoso\/5\/9$/,
        )

        expect(
          opcoes.method,
        ).toBe('PATCH')

        expect(
          JSON.parse(
            opcoes.body,
          ),
        ).toEqual({
          valor_1: 130,
        })
      },
    )
  },
)

/* =========================================================
   PERMISSÕES
========================================================= */

describe(
  'Saude — permissões',
  () => {
    it(
      'sem permissão oculta registro e edição do idoso',
      () => {
        mockUsePermissoes
          .mockReturnValue({
            estado: 'ok',
            escrita: false,
            avisoSemFlag: true,
          })

        render(<Saude />)

        expect(
          screen.queryByRole(
            'heading',
            {
              name:
                /registrar saúde do idoso/i,
            },
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.queryByRole(
            'heading',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByRole(
            'status',
          ),
        ).toHaveTextContent(
          /não possui permissão/i,
        )
      },
    )

    it(
      'com permissão mostra as seções do idoso',
      () => {
        mockUsePermissoes
          .mockReturnValue({
            estado: 'ok',
            escrita: true,
            avisoSemFlag: false,
          })

        render(<Saude />)

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                /registrar saúde do idoso/i,
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'erro de permissão mantém as seções e mostra alerta',
      () => {
        mockUsePermissoes
          .mockReturnValue({
            estado: 'erro',
            escrita: false,
            avisoSemFlag: false,
          })

        render(<Saude />)

        expect(
          screen.getByRole(
            'alert',
          ),
        ).toHaveTextContent(
          /não foi possível verificar suas permissões/i,
        )

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                /registrar saúde do idoso/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )
  },
)

/* =========================================================
   PRIVACIDADE
========================================================= */

describe(
  'Saude — privacidade',
  () => {
    it(
      'não imprime dados clínicos no console em caso de erro',
      async () => {
        (
          global.fetch as jest.Mock
        ).mockResolvedValue(
          respostaJson(400, {
            error:
              'valor inválido',
          }),
        )

        const spy =
          jest
            .spyOn(
              console,
              'error',
            )
            .mockImplementation(
              () => undefined,
            )

        try {
          const user =
            userEvent.setup()

          render(<Saude />)

          const titulo =
            screen.getByRole('heading', {
              name: /registrar leitura de saúde/i,
            })

          const section =
            titulo.closest('section')

          if (!section) {
            throw new Error(
              'Seção de registro próprio não encontrada.',
            )
          }

          const secao = within(section)

          await user.type(
            secao.getByLabelText(
              'Tipo de medição',
              {
                exact: true,
              },
            ),
            'pressao',
          )

          await user.type(
            secao.getByLabelText(
              'Valor 1',
              {
                exact: true,
              },
            ),
            '123.45',
          )

          await user.type(
            secao.getByLabelText(
              'Unidade',
              {
                exact: true,
              },
            ),
            'mmHg',
          )

          await user.type(
            secao.getByLabelText(
              'Observações (opcional)',
              {
                exact: true,
              },
            ),
            'segredo-clinico',
          )

          await user.click(
            secao.getByRole(
              'button',
              {
                name:
                  /^registrar leitura$/i,
              },
            ),
          )

          await screen.findByRole(
            'alert',
          )

          const logado =
            JSON.stringify(
              spy.mock.calls,
            )

          expect(
            logado,
          ).not.toContain(
            '123.45',
          )

          expect(
            logado,
          ).not.toContain(
            'segredo-clinico',
          )
        } finally {
          spy.mockRestore()
        }
      },
    )
  },
)

/* =========================================================
   SELETOR DE IDOSO — TELAS DE ESCRITA E PERFIL IDOSO
========================================================= */

describe(
  'Saude — seletor de idoso',
  () => {
    it(
      'escrita com 2+ idosos: não pré-seleciona e mantém o envio desabilitado até escolher',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const titulo =
          screen.getByRole(
            'heading',
            {
              name:
                /registrar saúde do idoso/i,
            },
          )

        const s = within(
          titulo.closest(
            'section',
          ) as HTMLElement,
        )

        const seletor =
          s.getByLabelText('Idoso')

        expect(seletor).toHaveValue('')

        expect(
          s.getByRole('option', {
            name: 'Selecione o idoso',
          }),
        ).toBeInTheDocument()

        const botao = s.getByRole(
          'button',
          {
            name:
              /registrar leitura do idoso/i,
          },
        )

        expect(botao).toBeDisabled()

        await user.selectOptions(
          seletor,
          '8',
        )

        expect(botao).toBeEnabled()
      },
    )

    it(
      'perfil idoso: seções de terceiros não renderizam, histórico e edição própria sim',
      () => {
        mockUseIdosos.mockReturnValue(
          listaPerfilIdoso,
        )

        render(<Saude />)

        expect(
          screen.queryByRole(
            'heading',
            {
              name:
                /registrar saúde do idoso/i,
            },
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.queryByRole(
            'heading',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                /histórico de saúde/i,
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                /editar meu registro/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
