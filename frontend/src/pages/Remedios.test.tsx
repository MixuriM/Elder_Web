import "@testing-library/jest-dom";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import Remedios from "./Remedios";

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
        <button type="button">
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
        <span data-testid="spinner">
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
  observacoes: "Tomar após o café.",
  ativo: true,
  doses: [
    {
      id: 10,
      status_administracao: "administrado",
      data_hora_administracao:
        "2026-10-05T12:30:00.000Z",
      observacoes: "Dose teste",
    },
  ],
};

const MEDICAMENTO_INATIVO = {
  id: 2,
  nome: "Medicamento Inativo",
  dosagem: "10 mg",
  frequencia: "2 vezes ao dia",
  data_inicio: "2026-09-01",
  data_fim: "2026-10-01",
  observacoes: null,
  ativo: false,
  doses: [],
};

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

beforeEach(() => {
  jest.clearAllMocks();

  mockUsePermissoesDose.mockReturnValue({
    carregando: false,
    podeMarcarDose: true,
    possuiVinculo: false,
    erro: null,
  });

  mockGetCurrentUserToken.mockResolvedValue(
    "token-fake",
  );

  mockChamarApi.mockResolvedValue({
    medicamentos: [],
  });

  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* =========================================================
   RENDERIZAÇÃO BÁSICA
========================================================= */

describe("Remedios - página principal", () => {
  it("renderiza o título e descrição", async () => {
    render(<Remedios />);

    expect(
      screen.getByRole("heading", {
        name: "Medicamentos",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /organize seus medicamentos/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockChamarApi).toHaveBeenCalled();
    });
  });

  it("carrega os medicamentos ao abrir a página", async () => {
    render(<Remedios />);

    await waitFor(() => {
      expect(mockChamarApi).toHaveBeenCalledWith(
        "/remedios",
        {
          method: "GET",
        },
      );
    });
  });

  it("mostra carregamento enquanto busca medicamentos", () => {
    mockChamarApi.mockReturnValue(
      new Promise(() => undefined),
    );

    render(<Remedios />);

    expect(
      screen.getByText(
        "Carregando medicamentos...",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("spinner"),
    ).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há medicamentos", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [],
    });

    render(<Remedios />);

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum medicamento cadastrado",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /adicione seu primeiro medicamento/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a API falha", async () => {
    mockChamarApi.mockRejectedValueOnce(
      new Error(
        "Não foi possível carregar os medicamentos.",
      ),
    );

    render(<Remedios />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Não foi possível carregar os medicamentos.",
    );
  });

  it("permite tentar carregar novamente após erro", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockRejectedValueOnce(
        new Error("Falha de teste."),
      )
      .mockResolvedValueOnce({
        medicamentos: [],
      });

    render(<Remedios />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Falha de teste.");

    await user.click(
      screen.getByRole("button", {
        name: /tentar novamente/i,
      }),
    );

    await waitFor(() => {
      expect(
        mockChamarApi,
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("botão voltar chama navigate(-1)", async () => {
    const user = userEvent.setup();

    render(<Remedios />);

    await user.click(
      screen.getByRole("button", {
        name: /voltar/i,
      }),
    );

    expect(
      mockNavigate,
    ).toHaveBeenCalledWith(-1);
  });
});

/* =========================================================
   LISTA DE MEDICAMENTOS
========================================================= */

describe("Remedios - lista", () => {
  it("renderiza medicamentos retornados pela API", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    expect(
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("50 mg"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("1 vez ao dia"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Ativo"),
    ).toBeInTheDocument();
  });

  it("mostra a quantidade de medicamentos", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [
        MEDICAMENTO,
        MEDICAMENTO_INATIVO,
      ],
    });

    render(<Remedios />);

    expect(
      await screen.findByText(
        "2 medicamentos cadastrados",
      ),
    ).toBeInTheDocument();
  });

  it("usa singular para apenas um medicamento", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    expect(
      await screen.findByText(
        "1 medicamento cadastrado",
      ),
    ).toBeInTheDocument();
  });

  it("medicamento inativo não permite marcar dose", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO_INATIVO],
    });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Medicamento Inativo",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    expect(
      within(card).getByRole("button", {
        name: /marcar dose/i,
      }),
    ).toBeDisabled();
  });
});

/* =========================================================
   MODAL DE CADASTRO
========================================================= */

describe("Remedios - cadastro", () => {
  it("abre o modal de adicionar medicamento", async () => {
    const user = userEvent.setup();

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    const botoes =
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      });

    await user.click(botoes[0]);

    expect(
      screen.getByRole("dialog"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Adicionar medicamento",
      }),
    ).toBeInTheDocument();
  });

  it("modal possui os campos do novo formulário", async () => {
    const user = userEvent.setup();

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    await user.click(
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      })[0],
    );

    expect(
      screen.getByLabelText(
        "Nome do medicamento",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Dosagem"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Frequência"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Data de início"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        "Data de término",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Observações"),
    ).toBeInTheDocument();
  });

  it("cadastra medicamento pela rota /remedios", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockResolvedValueOnce({
        medicamentos: [],
      })
      .mockResolvedValueOnce({
        id: 31,
      })
      .mockResolvedValue({
        medicamentos: [],
      });

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    await user.click(
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      })[0],
    );

    await user.type(
      screen.getByLabelText(
        "Nome do medicamento",
      ),
      "Losartana",
    );

    await user.type(
      screen.getByLabelText("Dosagem"),
      "50 mg",
    );

    await user.type(
      screen.getByLabelText("Frequência"),
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
      screen.getByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", {
        name: /^adicionar medicamento$/i,
      }),
    );

    await waitFor(() => {
      expect(mockChamarApi).toHaveBeenCalledWith(
        "/remedios",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const chamadaPost =
      mockChamarApi.mock.calls.find(
        ([, options]) =>
          options?.method === "POST",
      );

    expect(chamadaPost).toBeDefined();

    const body = JSON.parse(
      chamadaPost![1].body,
    );

    expect(body).toEqual({
      nome: "Losartana",
      dosagem: "50 mg",
      frequencia: "1 vez ao dia",
      data_inicio: "2026-10-05",
    });
  });

  it("envia campos opcionais quando preenchidos", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockResolvedValueOnce({
        medicamentos: [],
      })
      .mockResolvedValueOnce({
        id: 32,
      })
      .mockResolvedValue({
        medicamentos: [],
      });

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    await user.click(
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      })[0],
    );

    await user.type(
      screen.getByLabelText(
        "Nome do medicamento",
      ),
      "Medicamento Teste",
    );

    await user.type(
      screen.getByLabelText("Dosagem"),
      "10 mg",
    );

    await user.type(
      screen.getByLabelText("Frequência"),
      "2 vezes ao dia",
    );

    fireEvent.change(
      screen.getByLabelText(
        "Data de início",
      ),
      {
        target: {
          value: "2026-10-01",
        },
      },
    );

    fireEvent.change(
      screen.getByLabelText(
        "Data de término",
      ),
      {
        target: {
          value: "2026-12-31",
        },
      },
    );

    await user.type(
      screen.getByLabelText("Observações"),
      "Observação falsa",
    );

    const dialog =
      screen.getByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", {
        name: /^adicionar medicamento$/i,
      }),
    );

    await waitFor(() => {
      const chamadaPost =
        mockChamarApi.mock.calls.find(
          ([, options]) =>
            options?.method === "POST",
        );

      expect(chamadaPost).toBeDefined();

      const body = JSON.parse(
        chamadaPost![1].body,
      );

      expect(body).toMatchObject({
        data_fim: "2026-12-31",
        observacoes: "Observação falsa",
      });
    });
  });

  it("mostra erro quando cadastro falha", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockResolvedValueOnce({
        medicamentos: [],
      })
      .mockRejectedValueOnce(
        new Error(
          "Sem permissão para cadastrar medicamento.",
        ),
      );

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    await user.click(
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      })[0],
    );

    await user.type(
      screen.getByLabelText(
        "Nome do medicamento",
      ),
      "Teste",
    );

    await user.type(
      screen.getByLabelText("Dosagem"),
      "10 mg",
    );

    await user.type(
      screen.getByLabelText("Frequência"),
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

    await user.click(
      within(
        screen.getByRole("dialog"),
      ).getByRole("button", {
        name: /^adicionar medicamento$/i,
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Sem permissão para cadastrar medicamento.",
    );
  });
});

/* =========================================================
   HISTÓRICO
========================================================= */

describe("Remedios - histórico", () => {
  it("abre o histórico do medicamento", async () => {
    const user = userEvent.setup();

    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /ver histórico/i,
      }),
    );

    expect(
      screen.getByText(
        "Histórico de doses",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Dose teste"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Administrado"),
    ).toBeInTheDocument();
  });

  it("mostra estado vazio quando medicamento não possui doses", async () => {
    const user = userEvent.setup();

    mockChamarApi.mockResolvedValue({
      medicamentos: [
        MEDICAMENTO_INATIVO,
      ],
    });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Medicamento Inativo",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /ver histórico/i,
      }),
    );

    expect(
      screen.getByText(
        "Nenhuma dose registrada",
      ),
    ).toBeInTheDocument();
  });

  it("fecha o histórico", async () => {
    const user = userEvent.setup();

    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /ver histórico/i,
      }),
    );

    const secaoHistorico =
      screen
        .getByText("Histórico de doses")
        .closest("section") as HTMLElement;

    await user.click(
      within(secaoHistorico).getByRole(
        "button",
        {
          name: "Fechar",
        },
      ),
    );

    expect(
      screen.queryByText(
        "Histórico de doses",
      ),
    ).not.toBeInTheDocument();
  });
});

/* =========================================================
   MODAL DE DOSE
========================================================= */

describe("Remedios - marcar dose", () => {
  it("abre modal para medicamento ativo", async () => {
    const user = userEvent.setup();

    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /marcar dose/i,
      }),
    );

    const dialog =
      screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();

    expect(
      within(dialog).getByRole("heading", {
        name: "Losartana Teste",
      }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText(
        "Situação da dose",
      ),
    ).toBeInTheDocument();
  });

  it("registra uma dose", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockResolvedValueOnce({
        medicamentos: [MEDICAMENTO],
      })
      .mockResolvedValueOnce({
        id: 55,
      })
      .mockResolvedValue({
        medicamentos: [MEDICAMENTO],
      });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /marcar dose/i,
      }),
    );

    const dialog =
      screen.getByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", {
        name: "Pulado",
      }),
    );

    await user.type(
      within(dialog).getByLabelText(
        "Observações",
      ),
      "Dose não tomada",
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: /^registrar dose$/i,
      }),
    );

    await waitFor(() => {
      expect(
        mockChamarApi,
      ).toHaveBeenCalledWith(
        "/remedios/1/doses",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const chamadaPost =
      mockChamarApi.mock.calls.find(
        ([url, options]) =>
          url === "/remedios/1/doses" &&
          options?.method === "POST",
      );

    expect(chamadaPost).toBeDefined();

    const body = JSON.parse(
      chamadaPost![1].body,
    );

    expect(
      body.status_administracao,
    ).toBe("pulado");

    expect(
      body.observacoes,
    ).toBe("Dose não tomada");
  });

  it("mostra erro ao registrar dose", async () => {
    const user = userEvent.setup();

    mockChamarApi
      .mockResolvedValueOnce({
        medicamentos: [MEDICAMENTO],
      })
      .mockRejectedValueOnce(
        new Error(
          "Medicamento inativo.",
        ),
      )
      .mockResolvedValue({
        medicamentos: [MEDICAMENTO],
      });

    render(<Remedios />);

    const titulo =
      await screen.findByRole("heading", {
        name: "Losartana Teste",
      });

    const card =
      titulo.closest("article") as HTMLElement;

    await user.click(
      within(card).getByRole("button", {
        name: /marcar dose/i,
      }),
    );

    const dialog =
      screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", {
        name: /^registrar dose$/i,
      }),
    );

    expect(
      await within(dialog).findByRole(
        "alert",
        {},
        // CI lento estourava o timeout padrão de 1s (PR 151)
        { timeout: 4000 },
      ),
    ).toHaveTextContent(
      "Medicamento inativo.",
    );

    expect(
      mockChamarApi,
    ).toHaveBeenCalledWith(
      "/remedios/1/doses",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

/* =========================================================
   ACESSIBILIDADE BÁSICA
========================================================= */

describe("Remedios - acessibilidade básica", () => {
  it("botões principais possuem nomes acessíveis", async () => {
    mockChamarApi.mockResolvedValue({
      medicamentos: [MEDICAMENTO],
    });

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Losartana Teste",
    });

    expect(
      screen.getByRole("button", {
        name: /voltar/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /adicionar medicamento/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /marcar dose/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /ver histórico/i,
      }),
    ).toBeInTheDocument();
  });

  it("modal de cadastro possui role dialog", async () => {
    const user = userEvent.setup();

    render(<Remedios />);

    await screen.findByRole("heading", {
      name: "Nenhum medicamento cadastrado",
    });

    await user.click(
      screen.getAllByRole("button", {
        name: /adicionar medicamento/i,
      })[0],
    );

    expect(
      screen.getByRole("dialog"),
    ).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });
});