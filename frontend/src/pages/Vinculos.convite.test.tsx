import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Vinculos from "./Vinculos";
import { AcessoContext } from "../contexts/useAcesso";

// Convite do idoso ao cuidador, nas duas pontas da tela /cuidadores. Dados fake, só para o teste.
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: jest.fn().mockResolvedValue("token-fake"),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Data relativa a agora: o convite vale 7 dias, então uma data fixa viraria "vencido" com o tempo.
const DIA = 24 * 60 * 60 * 1000;
const baseConvite = {
  id: 40,
  tipo_vinculo: "cuidador",
  origem: "convite_idoso",
  status: "pendente",
  data_solicitacao: new Date(Date.now() - DIA).toISOString(),
  data_resposta: null,
  confirmado_em: null,
  permissoes: null,
};
// Visão do cuidador: o backend mostra nome e e-mail mascarado do idoso, nunca o id, enquanto o convite está pendente.
const conviteRecebido = {
  ...baseConvite,
  papel_do_chamador: "vinculado",
  idoso: { id: null, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 8, nome: "João Cuidador", email_mascarado: "jo***@mail.test" },
};
// Visão do idoso (dono) sobre o mesmo convite.
const conviteEnviado = {
  ...baseConvite,
  papel_do_chamador: "dono",
  idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 8, nome: "João Cuidador", email_mascarado: "jo***@mail.test" },
};

function renderComPerfil(tipoPerfil: string, tipo: "familiar" | "cuidador", recarregar?: () => void) {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil, temVinculoAprovado: false, temVinculoPendente: true, estado: "ok", recarregar }}
    >
      <MemoryRouter>
        <Vinculos tipo={tipo} />
      </MemoryRouter>
    </AcessoContext.Provider>
  );
}

type Rotas = Record<string, () => Response>;
function fetchPorRota(rotas: Rotas) {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? "GET"} ${String(url).replace(/^.*?(\/(vinculo|usuario).*)$/, "$1")}`;
    const resposta = rotas[chave];
    return Promise.resolve(resposta ? resposta() : respostaJson(500, { error: `sem rota: ${chave}` }));
  }) as jest.Mock;
}

const perfilIdoso = () => respostaJson(200, { id: 5, tipo_perfil: "idoso", modo_decisao: null });

describe("Vinculos: idoso convida cuidador", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("o botão Adicionar pessoa abre direto o convite de cuidador e envia para a rota de cuidador", async () => {
    fetchPorRota({
      "GET /usuario/me": perfilIdoso,
      "GET /vinculo": () => respostaJson(200, { vinculos: [] }),
      "POST /vinculo/convidar-cuidador": () => respostaJson(201, { registrado: true }),
    });
    renderComPerfil("idoso", "cuidador");

    await userEvent.click(await screen.findByRole("button", { name: "Adicionar pessoa" }));
    const dialogo = screen.getByRole("dialog", { name: "Adicionar pessoa" });
    await userEvent.type(within(dialogo).getByLabelText(/e-mail do cuidador/i), "cuidador.teste@exemplo.test");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Enviar convite" }));

    expect(await within(dialogo).findByRole("status")).toHaveTextContent("Convite enviado.");
    const chamada = (global.fetch as jest.Mock).mock.calls.find(
      ([url]: [string]) => String(url).endsWith("/vinculo/convidar-cuidador"),
    );
    expect(chamada[1].method).toBe("POST");
    expect(JSON.parse(chamada[1].body)).toEqual({ email: "cuidador.teste@exemplo.test" });
  });

  it("convite pendente aparece em Convites enviados, sem Aprovar, e não repete na lista de vinculados", async () => {
    fetchPorRota({
      "GET /usuario/me": perfilIdoso,
      "GET /vinculo": () => respostaJson(200, { vinculos: [conviteEnviado] }),
    });
    renderComPerfil("idoso", "cuidador");

    expect(await screen.findByRole("heading", { name: "Convites enviados" })).toBeInTheDocument();
    expect(screen.getByText("Convite enviado. Esperando o cuidador aceitar.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pedidos para você responder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprovar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pessoas vinculadas" })).not.toBeInTheDocument();
  });

  it("cancelar o convite usa /recusar e a lista recarrega", async () => {
    let cancelado = false;
    fetchPorRota({
      "GET /usuario/me": perfilIdoso,
      "GET /vinculo": () =>
        respostaJson(200, { vinculos: [cancelado ? { ...conviteEnviado, status: "recusado" } : conviteEnviado] }),
      "POST /vinculo/40/recusar": () => {
        cancelado = true;
        return respostaJson(200, { id: 40 });
      },
    });
    const recarregar = jest.fn();
    renderComPerfil("idoso", "cuidador", recarregar);

    await userEvent.click(await screen.findByRole("button", { name: /cancelar convite para João/i }));
    await userEvent.click(screen.getByRole("button", { name: "Sim, cancelar o convite" }));

    expect(await screen.findByText("Convite para João Cuidador cancelado.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Convites enviados" })).not.toBeInTheDocument();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});

describe("Vinculos: cuidador recebe convite", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("mostra Convites para você, sem repetir o convite na lista comum", async () => {
    fetchPorRota({ "GET /vinculo": () => respostaJson(200, { vinculos: [conviteRecebido] }) });
    renderComPerfil("cuidador", "cuidador");

    expect(await screen.findByRole("heading", { name: "Convites para você" })).toBeInTheDocument();
    const item = screen.getByRole("article", { name: /Maria Idosa/ });
    expect(within(item).getByText("Convidou você para ser cuidador dele")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pessoas vinculadas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver detalhes/i })).not.toBeInTheDocument();
  });

  it("aceitar chama a rota, recarrega a lista e o acesso (o menu libera as telas sem recarregar a página)", async () => {
    let aceito = false;
    fetchPorRota({
      "GET /vinculo": () =>
        respostaJson(200, {
          vinculos: [
            aceito
              ? { ...conviteRecebido, status: "aprovado", idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" } }
              : conviteRecebido,
          ],
        }),
      "POST /vinculo/40/aceitar-convite": () => {
        aceito = true;
        return respostaJson(200, { id: 40, status: "aprovado" });
      },
    });
    const recarregar = jest.fn();
    renderComPerfil("cuidador", "cuidador", recarregar);

    await userEvent.click(await screen.findByRole("button", { name: "Aceitar o convite de Maria Idosa" }));

    expect(await screen.findByText("Convite de Maria Idosa aceito.")).toBeInTheDocument();
    expect(await screen.findByText("1 cuidador vinculado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Convites para você" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoas vinculadas" })).toBeInTheDocument();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("convite recusado vira vínculo recusado e sai de Convites para você", async () => {
    let recusado = false;
    fetchPorRota({
      "GET /vinculo": () =>
        respostaJson(200, { vinculos: [recusado ? { ...conviteRecebido, status: "recusado" } : conviteRecebido] }),
      "POST /vinculo/40/recusar-convite": () => {
        recusado = true;
        return respostaJson(200, { id: 40, status: "recusado" });
      },
    });
    renderComPerfil("cuidador", "cuidador");

    await userEvent.click(await screen.findByRole("button", { name: "Recusar o convite de Maria Idosa" }));
    await userEvent.click(screen.getByRole("button", { name: "Sim, recusar" }));

    expect(await screen.findByText("Convite de Maria Idosa recusado.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Convites para você" })).not.toBeInTheDocument();
  });

  it("e-mail não confirmado: 403 com orientação fixa e o convite continua na tela", async () => {
    fetchPorRota({
      "GET /vinculo": () => respostaJson(200, { vinculos: [conviteRecebido] }),
      "POST /vinculo/40/aceitar-convite": () => respostaJson(403, { error: "SEGREDO-do-corpo" }),
    });
    renderComPerfil("cuidador", "cuidador");

    await userEvent.click(await screen.findByRole("button", { name: "Aceitar o convite de Maria Idosa" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confirme o seu e-mail no Meu Perfil antes de aceitar.");
    expect(document.body).not.toHaveTextContent("SEGREDO-do-corpo");
    expect(screen.getByRole("heading", { name: "Convites para você" })).toBeInTheDocument();
  });

  it("convite vencido: o cuidador só pode recusar e o idoso vê como convidar de novo", async () => {
    const vencido = { data_solicitacao: new Date(Date.now() - 30 * DIA).toISOString() };
    fetchPorRota({ "GET /vinculo": () => respostaJson(200, { vinculos: [{ ...conviteRecebido, ...vencido }] }) });
    const { unmount } = renderComPerfil("cuidador", "cuidador");

    expect(await screen.findByText("Convite vencido. Peça um novo convite ao idoso.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aceitar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusar o convite de Maria Idosa" })).toBeInTheDocument();
    unmount();

    fetchPorRota({
      "GET /usuario/me": perfilIdoso,
      "GET /vinculo": () => respostaJson(200, { vinculos: [{ ...conviteEnviado, ...vencido }] }),
    });
    renderComPerfil("idoso", "cuidador");
    expect(await screen.findByText("Convite vencido. Convide de novo pelo botão Adicionar pessoa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar convite para João/i })).toBeInTheDocument();
  });

  it("na tela de família o cuidador não vê a seção de convites", async () => {
    fetchPorRota({ "GET /vinculo": () => respostaJson(200, { vinculos: [conviteRecebido] }) });
    renderComPerfil("cuidador", "familiar");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Convites para você" })).not.toBeInTheDocument();
  });

  it("idoso e familiar não vêem a seção Convites para você", async () => {
    fetchPorRota({
      "GET /usuario/me": perfilIdoso,
      "GET /vinculo": () => respostaJson(200, { vinculos: [conviteRecebido] }),
    });
    renderComPerfil("idoso", "cuidador");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Convites para você" })).not.toBeInTheDocument();
  });
});
