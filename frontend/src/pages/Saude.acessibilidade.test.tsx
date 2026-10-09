import '@testing-library/jest-dom'

import {
  render,
  screen,
  within,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import Saude from './Saude'
import * as permissoesSaude from '../lib/permissoesSaude'
import { listaFamiliar } from '../hooks/idososFixtures'

/* =========================================================
   MOCK AUTH
========================================================= */

const mockGetCurrentUserToken = jest.fn()

jest.mock('../lib/auth', () => ({
  getCurrentUserToken: (...args: unknown[]) =>
    mockGetCurrentUserToken(...args),
}))

/* =========================================================
   MOCK IDOSOS VINCULADOS
========================================================= */

const mockUseIdosos = jest.fn()

jest.mock('../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => mockUseIdosos(),
}))

/* =========================================================
   MOCK PERMISSÕES
========================================================= */

jest.mock('../lib/permissoesSaude', () => ({
  ...jest.requireActual('../lib/permissoesSaude'),
  usePermissoesSaude: jest.fn(),
}))

const mockUsePermissoes =
  permissoesSaude.usePermissoesSaude as jest.Mock

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

function fetchMock() {
  return global.fetch as jest.Mock
}

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

beforeEach(() => {
  jest.clearAllMocks()

  mockUseIdosos.mockReturnValue(listaFamiliar)

  mockGetCurrentUserToken.mockResolvedValue(
    'token-fake',
  )

  global.fetch = jest.fn()

  mockUsePermissoes.mockReturnValue({
    estado: 'ok',
    escrita: true,
    avisoSemFlag: false,
  })
})

/* =========================================================
   ESTRUTURA ACESSÍVEL DA PÁGINA
========================================================= */

describe(
  'Saude — acessibilidade da página',
  () => {
    it(
      'possui título principal acessível',
      () => {
        render(<Saude />)

        expect(
          screen.getByRole('heading', {
            name: /minha saúde/i,
            level: 1,
          }),
        ).toBeInTheDocument()
      },
    )

    it(
      'possui as principais seções com títulos',
      () => {
        render(<Saude />)

        expect(
          screen.getByRole('heading', {
            name:
              /registrar leitura de saúde/i,
          }),
        ).toBeInTheDocument()

        expect(
          screen.getByRole('heading', {
            name:
              /registrar saúde do idoso/i,
          }),
        ).toBeInTheDocument()

        expect(
          screen.getByRole('heading', {
            name:
              /histórico de saúde/i,
          }),
        ).toBeInTheDocument()

        expect(
          screen.getByRole('heading', {
            name:
              /editar meu registro/i,
          }),
        ).toBeInTheDocument()

        expect(
          screen.getByRole('heading', {
            name:
              /editar registro do idoso/i,
          }),
        ).toBeInTheDocument()
      },
    )
  },
)

/* =========================================================
   LABELS — REGISTRO PRÓPRIO
========================================================= */

describe(
  'Saude — acessibilidade do registro próprio',
  () => {
    function pegarSecao() {
      const titulo =
        screen.getByRole(
          'heading',
          {
            name:
              /registrar leitura de saúde/i,
          },
        )

      const section =
        titulo.closest('section')

      if (!section) {
        throw new Error(
          'Seção de registro não encontrada.',
        )
      }

      return within(section)
    }

    it(
      'todos os campos possuem labels acessíveis',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByLabelText(
            'Tipo de medição',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 1',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 2 (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Unidade',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Data e hora (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Observações (opcional)',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'possui botão de envio acessível',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByRole(
            'button',
            {
              name:
                /^registrar leitura$/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'exibe erro com role alert',
      async () => {
        fetchMock().mockResolvedValue(
          respostaJson(400, {
            error:
              'Mensagem de erro de teste.',
          }),
        )

        const spy = jest
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

          const secao =
            pegarSecao()

          await user.type(
            secao.getByLabelText(
              'Tipo de medição',
            ),
            'peso',
          )

          await user.type(
            secao.getByLabelText(
              'Valor 1',
            ),
            '70',
          )

          await user.type(
            secao.getByLabelText(
              'Unidade',
            ),
            'kg',
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

          expect(
            await screen.findByRole(
              'alert',
            ),
          ).toHaveTextContent(
            'Mensagem de erro de teste.',
          )
        } finally {
          spy.mockRestore()
        }
      },
    )

    it(
      'exibe mensagem de sucesso',
      async () => {
        fetchMock().mockResolvedValue(
          respostaJson(201, {
            id: 11,
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        await user.type(
          secao.getByLabelText(
            'Tipo de medição',
          ),
          'peso',
        )

        await user.type(
          secao.getByLabelText(
            'Valor 1',
          ),
          '70',
        )

        await user.type(
          secao.getByLabelText(
            'Unidade',
          ),
          'kg',
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

        expect(
          await screen.findByText(
            /leitura registrada com sucesso/i,
          ),
        ).toBeInTheDocument()
      },
    )
  },
)

/* =========================================================
   LABELS — REGISTRO DO IDOSO
========================================================= */

describe(
  'Saude — acessibilidade do registro do idoso',
  () => {
    function pegarSecao() {
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
          'Seção de registro do idoso não encontrada.',
        )
      }

      return within(section)
    }

    it(
      'possui campos associados aos labels',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByLabelText(
            'Idoso',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Tipo de medição',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 1',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 2 (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Unidade',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Data e hora (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Observações (opcional)',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'possui botão acessível',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByRole(
            'button',
            {
              name:
                /registrar leitura do idoso/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'exibe erro com role alert',
      async () => {
        fetchMock().mockResolvedValue(
          respostaJson(400, {
            error:
              'Mensagem de erro de teste.',
          }),
        )

        const spy = jest
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

          const secao =
            pegarSecao()

          await user.selectOptions(
            secao.getByLabelText(
              'Idoso',
            ),
            '5',
          )

          await user.type(
            secao.getByLabelText(
              'Tipo de medição',
            ),
            'glicemia',
          )

          await user.type(
            secao.getByLabelText(
              'Valor 1',
            ),
            '95',
          )

          await user.type(
            secao.getByLabelText(
              'Unidade',
            ),
            'mg/dL',
          )

          await user.click(
            secao.getByRole(
              'button',
              {
                name:
                  /registrar leitura do idoso/i,
              },
            ),
          )

          expect(
            await screen.findByRole(
              'alert',
            ),
          ).toHaveTextContent(
            'Mensagem de erro de teste.',
          )
        } finally {
          spy.mockRestore()
        }
      },
    )
  },
)

/* =========================================================
   HISTÓRICO
========================================================= */

describe(
  'Saude — acessibilidade do histórico',
  () => {
    function pegarSecao() {
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
          'Seção de histórico não encontrada.',
        )
      }

      return within(section)
    }

    it(
      'seletor de idoso possui label e opções com nome',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        const seletor =
          secao.getByLabelText('Idoso')

        expect(
          seletor.tagName,
        ).toBe('SELECT')

        expect(
          within(seletor).getAllByRole(
            'option',
          )[0],
        ).toHaveTextContent(
          'Idoso Teste Cinco (c***@teste.com)',
        )
      },
    )

    it(
      'botão de histórico possui nome acessível',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByRole(
            'button',
            {
              name:
                /^ver histórico$/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'exibe histórico vazio de forma acessível',
      async () => {
        fetchMock().mockResolvedValue(
          respostaJson(200, {
            registros: [],
          }),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        await user.click(
          secao.getByRole(
            'button',
            {
              name:
                /^ver histórico$/i,
            },
          ),
        )

        expect(
          await secao.findByText(
            /nenhum registro encontrado/i,
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'exibe erro com role alert',
      async () => {
        fetchMock().mockResolvedValue(
          respostaJson(400, {
            error:
              'Erro ao carregar histórico.',
          }),
        )

        const spy = jest
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

          const secao =
            pegarSecao()

          await user.click(
            secao.getByRole(
              'button',
              {
                name:
                  /^ver histórico$/i,
              },
            ),
          )

          expect(
            await screen.findByRole(
              'alert',
            ),
          ).toHaveTextContent(
            'Erro ao carregar histórico.',
          )
        } finally {
          spy.mockRestore()
        }
      },
    )
  },
)

/* =========================================================
   EDIÇÃO PRÓPRIA
========================================================= */

describe(
  'Saude — acessibilidade da edição própria',
  () => {
    function pegarSecao() {
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
          'Seção de edição própria não encontrada.',
        )
      }

      return within(section)
    }

    it(
      'controle começa recolhido',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        const botao =
          secao.getByRole(
            'button',
            {
              name:
                /editar meu registro/i,
            },
          )

        expect(
          botao,
        ).toHaveAttribute(
          'aria-expanded',
          'false',
        )

        expect(
          secao.queryByLabelText(
            'ID do registro',
          ),
        ).not.toBeInTheDocument()
      },
    )

    it(
      'aria-expanded muda ao abrir',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        const botao =
          secao.getByRole(
            'button',
            {
              name:
                /editar meu registro/i,
            },
          )

        await user.click(botao)

        expect(
          botao,
        ).toHaveAttribute(
          'aria-expanded',
          'true',
        )

        expect(
          secao.getByLabelText(
            'ID do registro',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'campos possuem labels depois de abrir',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        await user.click(
          secao.getByRole(
            'button',
            {
              name:
                /editar meu registro/i,
            },
          ),
        )

        expect(
          secao.getByLabelText(
            'ID do registro',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Tipo de medição',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 1',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Valor 2 (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Unidade',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Data e hora (opcional)',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'Observações (opcional)',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'possui botão cancelar acessível',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        await user.click(
          secao.getByRole(
            'button',
            {
              name:
                /editar meu registro/i,
            },
          ),
        )

        expect(
          secao.getByRole(
            'button',
            {
              name: /cancelar/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )
  },
)

/* =========================================================
   EDIÇÃO DO IDOSO
========================================================= */

describe(
  'Saude — acessibilidade da edição do idoso',
  () => {
    function pegarSecao() {
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

      return within(section)
    }

    it(
      'controle possui aria-expanded',
      () => {
        render(<Saude />)

        const secao =
          pegarSecao()

        expect(
          secao.getByRole(
            'button',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        ).toHaveAttribute(
          'aria-expanded',
          'false',
        )
      },
    )

    it(
      'campos aparecem ao expandir',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        const botao =
          secao.getByRole(
            'button',
            {
              name:
                /editar registro do idoso/i,
            },
          )

        await user.click(botao)

        expect(
          botao,
        ).toHaveAttribute(
          'aria-expanded',
          'true',
        )

        expect(
          secao.getByLabelText(
            'Idoso',
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByLabelText(
            'ID do registro',
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'botões de salvar e cancelar possuem nomes acessíveis',
      async () => {
        const user =
          userEvent.setup()

        render(<Saude />)

        const secao =
          pegarSecao()

        await user.click(
          secao.getByRole(
            'button',
            {
              name:
                /editar registro do idoso/i,
            },
          ),
        )

        expect(
          secao.getByRole(
            'button',
            {
              name:
                /salvar alterações/i,
            },
          ),
        ).toBeInTheDocument()

        expect(
          secao.getByRole(
            'button',
            {
              name: /cancelar/i,
            },
          ),
        ).toBeInTheDocument()
      },
    )
  },
)

/* =========================================================
   PERMISSÕES
========================================================= */

describe(
  'Saude — acessibilidade das permissões',
  () => {
    it(
      'aviso de falta de permissão usa role status',
      () => {
        mockUsePermissoes.mockReturnValue({
          estado: 'ok',
          escrita: false,
          avisoSemFlag: true,
        })

        render(<Saude />)

        expect(
          screen.getByRole(
            'status',
          ),
        ).toBeInTheDocument()

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
      'oculta as ações do idoso sem permissão',
      () => {
        mockUsePermissoes.mockReturnValue({
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
      },
    )

    it(
      'erro de permissão usa role alert',
      () => {
        mockUsePermissoes.mockReturnValue({
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
      },
    )
  },
)

/* =========================================================
   ESTADO DE CARREGAMENTO
========================================================= */

describe(
  'Saude — acessibilidade do carregamento',
  () => {
    it(
      'exibe mensagem enquanto permissões carregam',
      () => {
        mockUsePermissoes.mockReturnValue({
          estado: 'carregando',
          escrita: false,
          avisoSemFlag: false,
        })

        render(<Saude />)

        expect(
          screen.getByText(
            /carregando informações de saúde/i,
          ),
        ).toBeInTheDocument()
      },
    )

    it(
      'desabilita botão durante registro',
      async () => {
        fetchMock().mockReturnValue(
          new Promise(
            () => undefined,
          ),
        )

        const user =
          userEvent.setup()

        render(<Saude />)

        const titulo =
          screen.getByRole(
            'heading',
            {
              name:
                /registrar leitura de saúde/i,
            },
          )

        const section =
          titulo.closest('section')

        if (!section) {
          throw new Error(
            'Seção de registro não encontrada.',
          )
        }

        const secao =
          within(section)

        await user.type(
          secao.getByLabelText(
            'Tipo de medição',
          ),
          'peso',
        )

        await user.type(
          secao.getByLabelText(
            'Valor 1',
          ),
          '70',
        )

        await user.type(
          secao.getByLabelText(
            'Unidade',
          ),
          'kg',
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

        const botao =
          await secao.findByRole(
            'button',
            {
              name:
                /registrando/i,
            },
          )

        expect(
          botao,
        ).toBeDisabled()
      },
    )
  },
)