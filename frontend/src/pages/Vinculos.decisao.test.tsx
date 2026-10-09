import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Vinculos from "./Vinculos";
import { AcessoContext } from "../contexts/useAcesso";

jest.mock("../lib/auth", () => ({
  getCurrentUserToken: jest.fn().mockResolvedValue("token-fake"),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Fixtures: dados fake, só para o teste.
const SEM_PEDIDO = {
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
};
const pedidoFamiliar = {
  id: 40,
  tipo_vinculo: "familiar",
  origem: "solicitacao_familiar",
  status: "pendente",
  data_solicitacao: "2026-10-01T10:00:00.000Z",
  data_resposta: null,
  confirmado_em: null,
  papel_do_chamador: "dono",
  permissoes: null,
  idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 9, nome: "Ana Familiar", email_mascarado: "an***@mail.test" },
};
const meuVinculo = { ...pedidoFamiliar, id: 41, status: "aprovado", papel_do_chamador: "vinculado" };

function renderComPerfil(tipoPerfil: string, tipo: "familiar" | "cuidador") {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok" }}
    >
      <MemoryRouter>
        <Vinculos tipo={tipo} />
      </MemoryRouter>
    </AcessoContext.Provider>
  );
}

describe("Vinculos: quem decide por mim", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("idoso passa a decisão para a família: a seção atualiza e os botões de pedido somem", async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "PATCH" && u.endsWith("/usuario/me/modo-decisao")) {
        return Promise.resolve(respostaJson(200, { modo_decisao: "familiar", ...SEM_PEDIDO }));
      }
      if (u.endsWith("/usuario/me")) return Promise.resolve(respostaJson(200, { modo_decisao: null, ...SEM_PEDIDO }));
      return Promise.resolve(respostaJson(200, { vinculos: [pedidoFamiliar] }));
    }) as jest.Mock;

    renderComPerfil("idoso", "familiar");
    expect(await screen.findByText("Hoje você decide.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aprovar o pedido de Ana/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Passar a decisão para minha família" }));
    await userEvent.click(screen.getByRole("button", { name: "Sim, passar a decisão" }));

    expect(await screen.findByText("Hoje quem decide é a sua família.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprovar o pedido de Ana/i })).not.toBeInTheDocument();
  });

  it("a seção só aparece na tela de família", async () => {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        String(url).endsWith("/usuario/me")
          ? respostaJson(200, { modo_decisao: null, ...SEM_PEDIDO })
          : respostaJson(200, { vinculos: [] })
      )
    ) as jest.Mock;
    renderComPerfil("idoso", "cuidador");
    await screen.findByRole("heading", { level: 1, name: "Cuidadores" });
    expect(screen.queryByRole("heading", { name: "Quem decide por mim" })).not.toBeInTheDocument();
  });

  it("familiar com vínculo aprovado vê a seção de pedir para decidir", async () => {
    global.fetch = jest.fn(() => Promise.resolve(respostaJson(200, { vinculos: [meuVinculo] }))) as jest.Mock;
    renderComPerfil("familiar", "familiar");
    expect(await screen.findByRole("heading", { name: "Quem decide pelo idoso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir para decidir por Maria Idosa" })).toBeInTheDocument();
  });
});
