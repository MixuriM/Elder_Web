import "@testing-library/jest-dom";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import Remedios from "./Remedios";

/* =========================================================
   AXE

   O jsdom não calcula contraste visual corretamente.
   Por isso color-contrast fica desativado neste teste.
========================================================= */

const AXE = {
  rules: {
    "color-contrast": {
      enabled: false,
    },
  },
};

/* =========================================================
   FUNÇÃO AUXILIAR
========================================================= */

async function esperarSemViolacoes(
  container: HTMLElement,
) {
  const resultado = await axe(
    container,
    AXE,
  );

  expect(
    resultado.violations,
  ).toHaveLength(0);
}

/* =========================================================
   MOCKS
========================================================= */

const mockNavigate = jest.fn();
const mockChamarApi = jest.fn();
const mockUsePermissoesDose = jest.fn();
const mockGetCurrentUserToken = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),

  useNavigate: () => mockNavigate,
}));

jest.mock("../lib/chamarApi", () => ({
  chamarApi: (...args: unknown[]) =>
    mockChamarApi(...args),
}));

jest.mock("../lib/permissoesDose", () => ({
  usePermissoesDose: () =>
    mockUsePermissoesDose(),
}));

jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) =>
    mockGetCurrentUserToken(...args),
}));

jest.mock(
  "../components/layout/ControleTema",
  () => {
    return function ControleTemaMock() {
      return (
        <button
          type="button"
          aria-label="Alternar tema"
        >
          Modo escuro
        </button>
      );
    };
  },
);

jest.mock(
  "../components/common/Spinner",
  () => {
    return function SpinnerMock() {
      return (
        <span
          data-testid="spinner"
          aria-hidden="true"
        >
          Carregando
        </span>
      );
    };
  },
);

/* =========================================================
   DADOS FALSOS
========================================================= */

const MEDICAMENTO = {
  id: 1,
  nome: "Losartana Teste",
  dosagem: "50 mg",
  frequencia: "1 vez ao dia",
  data_inicio: "2026-10-01",
  data_fim: null,
  observacoes:
    "Tomar após o café da manhã.",
  ativo: true,

  doses: [
    {
      id: 10,
      status_administracao:
        "administrado",
      data_hora_administracao:
        "2026-10-05T12:30:00.000Z",
      observacoes:
        "Dose registrada para teste.",
    },

    {
      id: 11,
      status_administracao: "pulado",
      data_hora_administracao:
        "2026-10-04T12:30:00.000Z",
      observacoes: null,
    },
  ],
};

const MEDICAMENTO_SEM_DOSES = {
  id: 2,
  nome: "Medicamento Teste Dois",
  dosagem: "10 mg",
  frequencia: "2 vezes ao dia",
  data_inicio: "2026-09-01",
  data_fim: null,
  observacoes: null,
  ativo: true,
  doses: [],
};

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

beforeEach(() => {
  jest.clearAllMocks();

  mockGetCurrentUserToken.mockResolvedValue(
    "token-fake",
  );

  mockUsePermissoesDose.mockReturnValue({
    carregando: false,
    podeMarcarDose: true,
    possuiVinculo: false,
    erro: null,
  });

  mockChamarApi.mockResolvedValue({
    medicamentos: [],
  });

  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* =========================================================
   CONTROLE DO JEST-AXE
========================================================= */

describe("jest-axe: controle", () => {
  it("detecta input sem label", async () => {
    const { container } = render(
      <input type="text" />,
    );

    const resultado = await axe(
      container,
      AXE,
    );

    expect(
      resultado.violations.map(
        (violacao) => violacao.id,
      ),
    ).toContain("label");
  });

  it("detecta botão sem nome acessível", async () => {
    const { container } = render(
      <button type="button" />,
    );

    const resultado = await axe(
      container,
      AXE,
    );

    expect(
      resultado.violations.map(
        (violacao) => violacao.id,
      ),
    ).toContain("button-name");
  });
});

/* =========================================================
   PÁGINA PRINCIPAL
========================================================= */

describe(
  "Remedios: acessibilidade da página",
  () => {
    it(
      "estado de carregamento não possui violações",
      async () => {
        mockChamarApi.mockReturnValue(
          new Promise(() => undefined),
        );

        const { container } = render(
          <Remedios />,
        );

        expect(
          screen.getByText(
            "Carregando medicamentos...",
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "estado vazio não possui violações",
      async () => {
        mockChamarApi.mockResolvedValue({
          medicamentos: [],
        });

        const { container } = render(
          <Remedios />,
        );

        await screen.findByRole(
          "heading",
          {
            name: "Nenhum medicamento cadastrado",
          },
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "estado com medicamentos não possui violações",
      async () => {
        mockChamarApi.mockResolvedValue({
          medicamentos: [
            MEDICAMENTO,
            MEDICAMENTO_SEM_DOSES,
          ],
        });

        const { container } = render(
          <Remedios />,
        );

        await screen.findByRole(
          "heading",
          {
            name: "Losartana Teste",
          },
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "estado de erro não possui violações",
      async () => {
        mockChamarApi.mockRejectedValueOnce(
          new Error(
            "Falha ao carregar medicamentos.",
          ),
        );

        const { container } = render(
          <Remedios />,
        );

        expect(
          await screen.findByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "Falha ao carregar medicamentos.",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "botão voltar possui nome acessível",
      async () => {
        const { container } = render(
          <Remedios />,
        );

        expect(
          screen.getByRole("button", {
            name: /voltar/i,
          }),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);

/* =========================================================
   CARDS
========================================================= */

describe(
  "Remedios: acessibilidade dos cards",
  () => {
    it(
      "card possui ações acessíveis",
      async () => {
        mockChamarApi.mockResolvedValue({
          medicamentos: [MEDICAMENTO],
        });

        const { container } = render(
          <Remedios />,
        );

        const titulo =
          await screen.findByRole(
            "heading",
            {
              name: "Losartana Teste",
            },
          );

        const card =
          titulo.closest("article");

        expect(card).not.toBeNull();

        if (!card) {
          throw new Error(
            "Card do medicamento não encontrado.",
          );
        }

        expect(
          within(card).getByRole(
            "button",
            {
              name: /marcar dose/i,
            },
          ),
        ).toBeInTheDocument();

        expect(
          within(card).getByRole(
            "button",
            {
              name: /ver histórico/i,
            },
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);

/* =========================================================
   MODAL DE CADASTRO
========================================================= */

describe(
  "Remedios: acessibilidade do cadastro",
  () => {
    async function abrirCadastro() {
      const user =
        userEvent.setup();

      const utils = render(
        <Remedios />,
      );

      await screen.findByRole(
        "heading",
        {
          name: "Nenhum medicamento cadastrado",
        },
      );

      const botoes =
        screen.getAllByRole(
          "button",
          {
            name: /adicionar medicamento/i,
          },
        );

      await user.click(
        botoes[0],
      );

      return {
        ...utils,
        user,
      };
    }

    it(
      "modal possui estrutura acessível",
      async () => {
        const { container } =
          await abrirCadastro();

        const dialog =
          screen.getByRole("dialog");

        expect(
          dialog,
        ).toHaveAttribute(
          "aria-modal",
          "true",
        );

        expect(
          dialog,
        ).toHaveAttribute(
          "aria-labelledby",
          "titulo-modal-medicamento",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "todos os campos possuem labels",
      async () => {
        const { container } =
          await abrirCadastro();

        expect(
          screen.getByLabelText(
            "Nome do medicamento",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByLabelText(
            "Dosagem",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByLabelText(
            "Frequência",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByLabelText(
            "Data de início",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByLabelText(
            "Data de término",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByLabelText(
            "Observações",
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "erro no cadastro continua acessível",
      async () => {
        const user =
          userEvent.setup();

        mockChamarApi
          .mockResolvedValueOnce({
            medicamentos: [],
          })
          .mockRejectedValueOnce(
            new Error(
              "Mensagem de erro de teste.",
            ),
          );

        const { container } =
          render(<Remedios />);

        await screen.findByRole(
          "heading",
          {
            name: "Nenhum medicamento cadastrado",
          },
        );

        await user.click(
          screen.getAllByRole(
            "button",
            {
              name: /adicionar medicamento/i,
            },
          )[0],
        );

        await user.type(
          screen.getByLabelText(
            "Nome do medicamento",
          ),
          "Medicamento Fictício",
        );

        await user.type(
          screen.getByLabelText(
            "Dosagem",
          ),
          "10 mg",
        );

        await user.type(
          screen.getByLabelText(
            "Frequência",
          ),
          "1 vez ao dia",
        );

        fireEvent.change(
          screen.getByLabelText(
            "Data de início",
          ),
          {
            target: {
              value: "2026-10-05",
            },
          },
        );

        const dialog =
          screen.getByRole(
            "dialog",
          );

        await user.click(
          within(dialog).getByRole(
            "button",
            {
              name: /^adicionar medicamento$/i,
            },
          ),
        );

        expect(
          await screen.findByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "Mensagem de erro de teste.",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "estado de envio do cadastro continua acessível",
      async () => {
        const user =
          userEvent.setup();

        mockChamarApi
          .mockResolvedValueOnce({
            medicamentos: [],
          })
          .mockReturnValueOnce(
            new Promise(
              () => undefined,
            ),
          );

        const { container } =
          render(<Remedios />);

        await screen.findByRole(
          "heading",
          {
            name: "Nenhum medicamento cadastrado",
          },
        );

        await user.click(
          screen.getAllByRole(
            "button",
            {
              name: /adicionar medicamento/i,
            },
          )[0],
        );

        await user.type(
          screen.getByLabelText(
            "Nome do medicamento",
          ),
          "Medicamento Fictício",
        );

        await user.type(
          screen.getByLabelText(
            "Dosagem",
          ),
          "10 mg",
        );

        await user.type(
          screen.getByLabelText(
            "Frequência",
          ),
          "1 vez ao dia",
        );

        fireEvent.change(
          screen.getByLabelText(
            "Data de início",
          ),
          {
            target: {
              value: "2026-10-05",
            },
          },
        );

        const dialog =
          screen.getByRole(
            "dialog",
          );

        await user.click(
          within(dialog).getByRole(
            "button",
            {
              name: /^adicionar medicamento$/i,
            },
          ),
        );

        const botao =
          await screen.findByRole(
            "button",
            {
              name: /adicionando/i,
            },
          );

        expect(
          botao,
        ).toBeDisabled();

        expect(
          botao,
        ).toHaveAttribute(
          "aria-busy",
          "true",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);

/* =========================================================
   MODAL DE DOSE
========================================================= */

describe(
  "Remedios: acessibilidade do modal de dose",
  () => {
    async function abrirDose() {
      mockChamarApi.mockResolvedValue({
        medicamentos: [
          MEDICAMENTO,
        ],
      });

      const user =
        userEvent.setup();

      const utils = render(
        <Remedios />,
      );

      const titulo =
        await screen.findByRole(
          "heading",
          {
            name: "Losartana Teste",
          },
        );

      const card =
        titulo.closest("article");

      if (!card) {
        throw new Error(
          "Card do medicamento não encontrado.",
        );
      }

      await user.click(
        within(card).getByRole(
          "button",
          {
            name: /marcar dose/i,
          },
        ),
      );

      return {
        ...utils,
        user,
      };
    }

    it(
      "modal possui estrutura acessível",
      async () => {
        const { container } =
          await abrirDose();

        const dialog =
          screen.getByRole(
            "dialog",
          );

        expect(
          dialog,
        ).toHaveAttribute(
          "aria-modal",
          "true",
        );

        expect(
          dialog,
        ).toHaveAttribute(
          "aria-labelledby",
          "titulo-modal-dose",
        );

        expect(
          within(dialog).getByText(
            "Situação da dose",
          ),
        ).toBeInTheDocument();

        expect(
          within(dialog).getByLabelText(
            "Data e hora",
          ),
        ).toBeInTheDocument();

        expect(
          within(dialog).getByLabelText(
            "Observações",
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "opções possuem aria-pressed",
      async () => {
        const {
          container,
          user,
        } = await abrirDose();

        const dialog =
          screen.getByRole(
            "dialog",
          );

        const tomado =
          within(dialog).getByRole(
            "button",
            {
              name: "Tomado",
            },
          );

        const atrasado =
          within(dialog).getByRole(
            "button",
            {
              name: "Atrasado",
            },
          );

        const pulado =
          within(dialog).getByRole(
            "button",
            {
              name: "Pulado",
            },
          );

        expect(
          tomado,
        ).toHaveAttribute(
          "aria-pressed",
          "true",
        );

        expect(
          atrasado,
        ).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        expect(
          pulado,
        ).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        await user.click(
          atrasado,
        );

        expect(
          atrasado,
        ).toHaveAttribute(
          "aria-pressed",
          "true",
        );

        expect(
          tomado,
        ).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "erro ao registrar dose continua acessível",
      async () => {
        const user =
          userEvent.setup();

        mockChamarApi
          .mockResolvedValueOnce({
            medicamentos: [
              MEDICAMENTO,
            ],
          })
          .mockRejectedValueOnce(
            new Error(
              "Mensagem de erro de teste.",
            ),
          );

        const { container } =
          render(<Remedios />);

        const titulo =
          await screen.findByRole(
            "heading",
            {
              name: "Losartana Teste",
            },
          );

        const card =
          titulo.closest(
            "article",
          );

        if (!card) {
          throw new Error(
            "Card não encontrado.",
          );
        }

        await user.click(
          within(card).getByRole(
            "button",
            {
              name: /marcar dose/i,
            },
          ),
        );

        const dialog =
          screen.getByRole(
            "dialog",
          );

        await user.click(
          within(dialog).getByRole(
            "button",
            {
              name: /^registrar dose$/i,
            },
          ),
        );

        expect(
          await screen.findByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "Mensagem de erro de teste.",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "estado de envio da dose continua acessível",
      async () => {
        const user =
          userEvent.setup();

        mockChamarApi
          .mockResolvedValueOnce({
            medicamentos: [
              MEDICAMENTO,
            ],
          })
          .mockReturnValueOnce(
            new Promise(
              () => undefined,
            ),
          );

        const { container } =
          render(<Remedios />);

        const titulo =
          await screen.findByRole(
            "heading",
            {
              name: "Losartana Teste",
            },
          );

        const card =
          titulo.closest(
            "article",
          );

        if (!card) {
          throw new Error(
            "Card não encontrado.",
          );
        }

        await user.click(
          within(card).getByRole(
            "button",
            {
              name: /marcar dose/i,
            },
          ),
        );

        const dialog =
          screen.getByRole(
            "dialog",
          );

        await user.click(
          within(dialog).getByRole(
            "button",
            {
              name: /^registrar dose$/i,
            },
          ),
        );

        const botao =
          await screen.findByRole(
            "button",
            {
              name: /registrando/i,
            },
          );

        expect(
          botao,
        ).toBeDisabled();

        expect(
          botao,
        ).toHaveAttribute(
          "aria-busy",
          "true",
        );

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);

/* =========================================================
   HISTÓRICO
========================================================= */

describe(
  "Remedios: acessibilidade do histórico",
  () => {
    it(
      "histórico com doses não possui violações",
      async () => {
        mockChamarApi.mockResolvedValue({
          medicamentos: [
            MEDICAMENTO,
          ],
        });

        const user =
          userEvent.setup();

        const { container } =
          render(<Remedios />);

        const titulo =
          await screen.findByRole(
            "heading",
            {
              name: "Losartana Teste",
            },
          );

        const card =
          titulo.closest(
            "article",
          );

        if (!card) {
          throw new Error(
            "Card não encontrado.",
          );
        }

        await user.click(
          within(card).getByRole(
            "button",
            {
              name: /ver histórico/i,
            },
          ),
        );

        expect(
          screen.getByText(
            "Histórico de doses",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Administrado",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Pulado",
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );

    it(
      "histórico vazio não possui violações",
      async () => {
        mockChamarApi.mockResolvedValue({
          medicamentos: [
            MEDICAMENTO_SEM_DOSES,
          ],
        });

        const user =
          userEvent.setup();

        const { container } =
          render(<Remedios />);

        const titulo =
          await screen.findByRole(
            "heading",
            {
              name: "Medicamento Teste Dois",
            },
          );

        const card =
          titulo.closest(
            "article",
          );

        if (!card) {
          throw new Error(
            "Card não encontrado.",
          );
        }

        await user.click(
          within(card).getByRole(
            "button",
            {
              name: /ver histórico/i,
            },
          ),
        );

        expect(
          screen.getByText(
            "Nenhuma dose registrada",
          ),
        ).toBeInTheDocument();

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);

/* =========================================================
   PERMISSÕES
========================================================= */

describe(
  "Remedios: acessibilidade das permissões",
  () => {
    it(
      "aviso de permissão continua acessível",
      async () => {
        mockUsePermissoesDose.mockReturnValue({
          carregando: false,
          podeMarcarDose: false,
          possuiVinculo: true,
          erro: null,
        });

        const { container } =
          render(<Remedios />);

        await waitFor(() => {
          expect(
            screen.getByRole(
              "status",
            ),
          ).toBeInTheDocument();
        });

        await esperarSemViolacoes(
          container,
        );
      },
    );
  },
);