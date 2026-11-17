import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";

import Remedios from "./Remedios";
import { AcessoContext } from "../contexts/useAcesso";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { listaDoisIdosos7, listaPerfilIdoso } from "../hooks/idososFixtures";

expect.extend(toHaveNoViolations);

// Fase 11: Editar e Remover medicamento. Dados obviamente falsos, só de teste.
const AXE = { rules: { "color-contrast": { enabled: false } } };

const mockChamarApi = jest.fn();
const mockUseIdosos = jest.fn();

jest.mock("../hooks/useIdososVinculados", () => ({ useIdososVinculados: () => mockUseIdosos() }));
jest.mock("../lib/chamarApi", () => ({ chamarApi: (...args: unknown[]) => mockChamarApi(...args) }));
jest.mock("../lib/permissoesDose", () => ({
  usePermissoesDose: () => ({ estado: "ok", escrita: true, avisoSemFlag: false }),
}));
jest.mock("../lib/auth", () => ({ getCurrentUserToken: () => Promise.resolve("token-fake") }));

type Med = {
  id: number;
  nome: string;
  dosagem: string;
  frequencia: string;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  ativo: boolean;
  doses: unknown[];
};

const LOSARTANA: Med = {
  id: 1,
  nome: "Losartana Teste",
  dosagem: "50 mg",
  frequencia: "1 vez ao dia",
  data_inicio: "2026-10-01",
  data_fim: "2026-12-01",
  observacoes: "Tomar após o café.",
  ativo: true,
  doses: [{ id: 10, status_administracao: "administrado", data_hora_administracao: "2026-10-05T12:30:00.000Z", observacoes: null }],
};
const OUTRO: Med = { ...LOSARTANA, id: 2, nome: "Metformina Teste", data_fim: null, observacoes: null, doses: [] };

let medicamentos: Med[];
let falhas: Record<string, number>;

function chamadas(metodo: string) {
  return mockChamarApi.mock.calls
    .filter(([, o]) => (o?.method ?? "GET") === metodo)
    .map(([caminho, o]) => ({ caminho: caminho as string, body: o?.body ? JSON.parse(o.body) : undefined }));
}

function vinculoFamiliar(modo: "idoso" | "familiar"): Vinculo {
  return {
    id: 1,
    tipo_vinculo: "familiar",
    origem: "solicitacao_familiar",
    status: "aprovado",
    papel_do_chamador: "vinculado",
    decisao: { modo, transferencia: null },
    idoso: { id: 7, nome: "Idoso Teste Sete", email_mascarado: null },
    vinculado: { id: 50, nome: "Eu", email_mascarado: null },
  } as Vinculo;
}

function renderRemedios(perfil: string = "idoso", vinculos: Vinculo[] | null = null) {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil: perfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok", vinculos }}
    >
      <MemoryRouter>
        <Remedios />
      </MemoryRouter>
    </AcessoContext.Provider>,
  );
}

function comoTerceiro(tipoPerfil: "familiar" | "cuidador") {
  mockUseIdosos.mockReturnValue({ ...listaDoisIdosos7, tipoPerfil });
}

beforeEach(() => {
  jest.clearAllMocks();
  medicamentos = [{ ...LOSARTANA }, { ...OUTRO }];
  falhas = {};
  mockUseIdosos.mockReturnValue(listaPerfilIdoso);
  mockChamarApi.mockImplementation((caminho: string, opcoes?: RequestInit) => {
    const metodo = opcoes?.method ?? "GET";
    if (falhas[metodo]) return Promise.reject(Object.assign(new Error("TEXTO SENSIVEL DO SERVIDOR"), { status: falhas[metodo] }));
    if (metodo === "GET") return Promise.resolve({ medicamentos });
    if (metodo === "DELETE") {
      const id = Number(caminho.split("/").pop());
      medicamentos = medicamentos.filter((m) => m.id !== id);
      return Promise.resolve(null);
    }
    return Promise.resolve({});
  });
});

describe("Remedios: quem vê Editar e Remover", () => {
  it("idoso vê nos dois cartões, com texto visível e nome pelo medicamento, sem tirar Marcar dose nem Ver histórico", async () => {
    renderRemedios();

    const editar = await screen.findByRole("button", { name: "Editar medicamento Losartana Teste" });
    expect(editar).toHaveTextContent("Editar");
    expect(screen.getByRole("button", { name: "Remover medicamento Losartana Teste" })).toHaveTextContent("Remover");
    expect(screen.getByRole("button", { name: "Editar medicamento Metformina Teste" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /marcar dose/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /ver histórico/i })).toHaveLength(2);
  });

  it("cuidador nunca vê, mesmo podendo marcar dose", async () => {
    comoTerceiro("cuidador");
    renderRemedios("cuidador", null);

    await screen.findByText("Losartana Teste");
    expect(screen.queryByRole("button", { name: /^editar medicamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remover medicamento/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /marcar dose/i }).length).toBeGreaterThan(0);
  });

  it("familiar vê só com o modo de decisão familiar no idoso escolhido", async () => {
    comoTerceiro("familiar");
    const { unmount } = renderRemedios("familiar", [vinculoFamiliar("familiar")]);
    expect(await screen.findByRole("button", { name: "Editar medicamento Losartana Teste" })).toBeInTheDocument();
    unmount();

    renderRemedios("familiar", [vinculoFamiliar("idoso")]);
    await screen.findByText("Losartana Teste");
    expect(screen.queryByRole("button", { name: /^editar medicamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remover medicamento/i })).not.toBeInTheDocument();
  });
});

describe("Remedios: editar", () => {
  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Editar medicamento Losartana Teste" }));
    return screen.getByRole("dialog", { name: "Editar medicamento" });
  }

  it("abre com os dados do medicamento; Cancelar fecha sem chamar a API", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    expect(within(dialogo).getByLabelText("Nome do medicamento")).toHaveValue("Losartana Teste");
    expect(within(dialogo).getByLabelText("Dosagem")).toHaveValue("50 mg");
    expect(within(dialogo).getByLabelText("Frequência")).toHaveValue("1 vez ao dia");
    expect(within(dialogo).getByLabelText("Data de início")).toHaveValue("2026-10-01");
    expect(within(dialogo).getByLabelText("Data de término")).toHaveValue("2026-12-01");
    expect(within(dialogo).getByLabelText("Observações")).toHaveValue("Tomar após o café.");

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chamadas("PATCH")).toHaveLength(0);
  });

  it("salva: PATCH /remedios/:id, fecha, avisa e recarrega a lista", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    await user.clear(within(dialogo).getByLabelText("Dosagem"));
    await user.type(within(dialogo).getByLabelText("Dosagem"), "100 mg");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(chamadas("PATCH")).toEqual([
      {
        caminho: "/remedios/1",
        body: {
          nome: "Losartana Teste",
          dosagem: "100 mg",
          frequencia: "1 vez ao dia",
          data_inicio: "2026-10-01",
          data_fim: "2026-12-01",
          observacoes: "Tomar após o café.",
        },
      },
    ]);
    expect(screen.getByText("Medicamento atualizado.").closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(chamadas("GET")).toHaveLength(2));
  });

  it("campos opcionais esvaziados vão como null (limpam no servidor)", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    await user.clear(within(dialogo).getByLabelText("Observações"));
    fireEvent.change(within(dialogo).getByLabelText("Data de término"), { target: { value: "" } });
    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(chamadas("PATCH")).toHaveLength(1));
    expect(chamadas("PATCH")[0].body).toMatchObject({ data_fim: null, observacoes: null });
  });

  it("familiar salva pelo caminho do idoso escolhido", async () => {
    const user = userEvent.setup();
    comoTerceiro("familiar");
    renderRemedios("familiar", [vinculoFamiliar("familiar")]);
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(chamadas("PATCH")[0]?.caminho).toBe("/remedios/idoso/7/1"));
  });

  it("término antes do início: avisa no modal, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    fireEvent.change(within(dialogo).getByLabelText("Data de término"), { target: { value: "2026-09-01" } });
    // O navegador também barra isso (min no campo); aqui vale a validação do próprio código.
    dialogo.querySelector("form")?.setAttribute("novalidate", "");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    expect(within(dialogo).getByRole("alert")).toHaveTextContent("A data de término não pode ser antes da data de início.");
    expect(chamadas("PATCH")).toHaveLength(0);
  });

  it("nome em branco: pede para preencher, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    await user.clear(within(dialogo).getByLabelText("Nome do medicamento"));
    dialogo.querySelector("form")?.setAttribute("novalidate", "");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Preencha nome, dosagem, frequência e a data de início.");
    expect(chamadas("PATCH")).toHaveLength(0);
  });

  it("erro do servidor: mensagem fixa no modal, que segue aberto e habilitado", async () => {
    const user = userEvent.setup();
    falhas.PATCH = 403;
    renderRemedios();
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toHaveTextContent("Você não tem permissão para alterar este registro.");
    expect(alerta).not.toHaveTextContent("TEXTO SENSIVEL");
    expect(within(dialogo).getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  });

  it("enquanto salva: campos e botões desabilitados", async () => {
    const user = userEvent.setup();
    let liberar: () => void = () => {};
    const original = mockChamarApi.getMockImplementation()!;
    mockChamarApi.mockImplementation((caminho: string, o?: RequestInit) =>
      o?.method === "PATCH" ? new Promise((r) => (liberar = () => r({}))) : original(caminho, o),
    );
    renderRemedios();
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    expect(within(dialogo).getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(dialogo).getByLabelText("Dosagem")).toBeDisabled();

    liberar();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("com o histórico de doses aberto, mostra o nome novo depois de salvar", async () => {
    const user = userEvent.setup();
    renderRemedios();
    await user.click((await screen.findAllByRole("button", { name: /ver histórico/i }))[0]);
    expect(screen.getByRole("heading", { level: 2, name: "Losartana Teste" })).toBeInTheDocument();

    medicamentos = [{ ...LOSARTANA, nome: "Losartana Nova" }, { ...OUTRO }];
    await user.click(screen.getByRole("button", { name: "Editar medicamento Losartana Teste" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Losartana Nova" })).toBeInTheDocument();
  });

  it("modal acessível: dialog modal, foco dentro e sem violações", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveFocus();
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });
});

describe("Remedios: remover", () => {
  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Remover medicamento Losartana Teste" }));
    return screen.getByRole("alertdialog", { name: "Remover medicamento" });
  }

  it("pede confirmação com o nome e o aviso das doses; Cancelar não chama a API", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    expect(dialogo).toHaveTextContent(
      "Remover Losartana Teste? O histórico de doses dele também será apagado. Esta ação não pode ser desfeita.",
    );
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(chamadas("DELETE")).toHaveLength(0);
  });

  it("confirmar: DELETE /remedios/:id, fecha, recarrega a lista e avisa", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(chamadas("DELETE").map((c) => c.caminho)).toEqual(["/remedios/1"]);
    await waitFor(() => expect(screen.queryByText("Losartana Teste")).not.toBeInTheDocument());
    expect(screen.getByText("Metformina Teste")).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((s) => /medicamento removido/i.test(s.textContent ?? ""))).toBe(true);
  });

  it("familiar remove pelo caminho do idoso escolhido", async () => {
    const user = userEvent.setup();
    comoTerceiro("familiar");
    renderRemedios("familiar", [vinculoFamiliar("familiar")]);
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(chamadas("DELETE").map((c) => c.caminho)).toEqual(["/remedios/idoso/7/1"]));
  });

  it("404: mensagem fixa na confirmação, que segue aberta", async () => {
    const user = userEvent.setup();
    falhas.DELETE = 404;
    renderRemedios();
    const dialogo = await abrir(user);

    await user.click(within(dialogo).getByRole("button", { name: "Remover" }));

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toHaveTextContent("Este registro já foi removido. Feche e atualize a lista.");
    expect(alerta).not.toHaveTextContent("TEXTO SENSIVEL");
  });

  it("se o histórico de doses aberto era do medicamento removido, ele fecha", async () => {
    const user = userEvent.setup();
    renderRemedios();
    await user.click((await screen.findAllByRole("button", { name: /ver histórico/i }))[0]);
    expect(screen.getByRole("heading", { level: 2, name: "Losartana Teste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover medicamento Losartana Teste" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByText("Histórico de doses")).not.toBeInTheDocument());
  });

  it("se o histórico de doses aberto era de outro medicamento, ele continua aberto", async () => {
    const user = userEvent.setup();
    renderRemedios();
    await user.click((await screen.findAllByRole("button", { name: /ver histórico/i }))[1]);
    expect(screen.getByRole("heading", { level: 2, name: "Metformina Teste" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover medicamento Losartana Teste" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(chamadas("DELETE")).toHaveLength(1));
    expect(await screen.findByRole("heading", { level: 2, name: "Metformina Teste" })).toBeInTheDocument();
  });

  it("confirmação acessível: alertdialog, foco dentro e sem violações", async () => {
    const user = userEvent.setup();
    renderRemedios();
    const dialogo = await abrir(user);

    expect(dialogo).toHaveFocus();
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });
});
