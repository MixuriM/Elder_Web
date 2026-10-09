import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VinculoDetalhe from "./VinculoDetalhe";
import { AcessoContext } from "../contexts/useAcesso";

jest.mock("../lib/auth", () => ({
  getCurrentUserToken: jest.fn().mockResolvedValue("token-fake"),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Fixtures: dados fake, só para o teste.
const cuidador = {
  id: 12,
  tipo_vinculo: "cuidador",
  origem: "solicitacao_cuidador",
  status: "aprovado",
  data_solicitacao: "2026-10-01T10:00:00.000Z",
  data_resposta: "2026-10-02T10:00:00.000Z",
  confirmado_em: null,
  papel_do_chamador: "dono",
  permissoes: { permite_registrar_saude: false, permite_marcar_dose: true, permite_criar_evento_cuidado: false },
  idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 8, nome: "João Cuidador", email_mascarado: "jo***@mail.test" },
};

function renderDetalhe(tipoPerfil: string, vinculo: object, modo: string | null = null) {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === "PATCH" && u.endsWith("/vinculo/12/definir-permissoes")) {
      return Promise.resolve(
        respostaJson(200, { id: 12, permite_registrar_saude: false, permite_marcar_dose: true, permite_criar_evento_cuidado: true })
      );
    }
    if (u.endsWith("/usuario/me")) return Promise.resolve(respostaJson(200, { modo_decisao: modo }));
    return Promise.resolve(respostaJson(200, { vinculos: [vinculo] }));
  }) as jest.Mock;

  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok" }}
    >
      <MemoryRouter initialEntries={["/vinculos/12"]}>
        <Routes>
          <Route path="/vinculos/:id" element={<VinculoDetalhe />} />
        </Routes>
      </MemoryRouter>
    </AcessoContext.Provider>
  );
}

describe("VinculoDetalhe: permissões do cuidador", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("idoso que decide edita as permissões e o envio chega ao backend", async () => {
    renderDetalhe("idoso", cuidador);
    const interruptor = await screen.findByRole("switch", { name: /compromissos de cuidado/i });
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    await userEvent.click(interruptor);
    expect(await screen.findByRole("status")).toHaveTextContent("Compromissos de cuidado: ligado.");
    expect(interruptor).toHaveAttribute("aria-checked", "true");
  });

  it("familiar titular edita", async () => {
    renderDetalhe("familiar", { ...cuidador, papel_do_chamador: "titular" });
    expect(await screen.findAllByRole("switch")).toHaveLength(3);
  });

  it.each([
    ["idoso com modo familiar", "idoso", cuidador, "familiar"],
    ["o próprio cuidador", "cuidador", { ...cuidador, papel_do_chamador: "vinculado" }, null],
  ])("%s vê só leitura", async (_nome, perfil, vinculo, modo) => {
    renderDetalhe(perfil, vinculo, modo);
    await screen.findByRole("heading", { name: /o que .* pode fazer/i });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("Ligado")).toBeInTheDocument();
    expect(screen.getAllByText("Desligado")).toHaveLength(2);
  });

  it.each([
    ["cuidador ainda pendente", { ...cuidador, status: "pendente", permissoes: null }],
    ["vínculo de familiar", { ...cuidador, tipo_vinculo: "familiar", permissoes: null }],
  ])("%s não mostra permissões", async (_nome, vinculo) => {
    renderDetalhe("idoso", vinculo);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: /pode fazer/i })).not.toBeInTheDocument();
  });

  it("vínculo automático pendente sem confirmação mostra o aviso de e-mail", async () => {
    renderDetalhe("idoso", {
      ...cuidador,
      tipo_vinculo: "familiar",
      origem: "convite_idoso",
      status: "pendente",
      permissoes: null,
    });
    expect(await screen.findByText(/o e-mail ainda não foi confirmado/i)).toBeInTheDocument();
  });
});
