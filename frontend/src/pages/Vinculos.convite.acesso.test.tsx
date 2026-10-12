import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Vinculos from "./Vinculos";
import { AcessoProvider } from "../contexts/AcessoContext";
import { useAcesso } from "../contexts/useAcesso";
import { itensDoMenu } from "../lib/menuPorPerfil";

// Cuidador convidado: sem vínculo aprovado o menu fica enxuto (D1 e D2 de 08/10) e, depois do aceite, libera as telas
// de dados sem recarregar a página, porque a tela chama o recarregamento do acesso. Provider real, fetch por rota.
// Dados fake, só para o teste.
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: jest.fn().mockResolvedValue("token-fake"),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

const convite = {
  id: 40,
  tipo_vinculo: "cuidador",
  origem: "convite_idoso",
  status: "pendente",
  data_solicitacao: "2026-10-10T10:00:00.000Z",
  data_resposta: null,
  confirmado_em: null,
  papel_do_chamador: "vinculado",
  permissoes: null,
  idoso: { id: null, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 8, nome: "João Cuidador", email_mascarado: "jo***@mail.test" },
};

function Menu() {
  const itens = itensDoMenu(useAcesso());
  return (
    <ul aria-label="Menu de teste">
      {itens.map((i) => (
        <li key={i.to}>{i.label}</li>
      ))}
    </ul>
  );
}

describe("Vinculos: o aceite do convite libera o menu do cuidador", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("antes: só Início, Meu Perfil, Cuidadores e Orientações; depois de aceitar: libera o resto", async () => {
    let aceito = false;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const rota = String(url).replace(/^.*?(\/(vinculo|usuario).*)$/, "$1");
      const chave = `${init?.method ?? "GET"} ${rota}`;
      if (chave === "GET /usuario/me") {
        return Promise.resolve(respostaJson(200, { id: 8, nome: "João Cuidador", tipo_perfil: "cuidador" }));
      }
      if (chave === "GET /vinculo") {
        return Promise.resolve(
          respostaJson(200, {
            vinculos: [
              aceito
                ? { ...convite, status: "aprovado", idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" } }
                : convite,
            ],
          }),
        );
      }
      if (chave === "POST /vinculo/40/aceitar-convite") {
        aceito = true;
        return Promise.resolve(respostaJson(200, { id: 40, status: "aprovado" }));
      }
      return Promise.resolve(respostaJson(500, { error: `sem rota: ${chave}` }));
    }) as jest.Mock;

    render(
      <AcessoProvider>
        <MemoryRouter>
          <Menu />
          <Vinculos tipo="cuidador" />
        </MemoryRouter>
      </AcessoProvider>,
    );

    const menu = screen.getByRole("list", { name: "Menu de teste" });
    await screen.findByRole("heading", { name: "Convites para você" });
    const nomes = () => within(menu).getAllByRole("listitem").map((li) => li.textContent);
    await screen.findByText("Cuidadores", { selector: "li" });
    expect(nomes()).toEqual(["Início", "Meu Perfil", "Cuidadores", "Orientações"]);

    await userEvent.click(screen.getByRole("button", { name: "Aceitar o convite de Maria Idosa" }));

    expect(await screen.findByText("Convite de Maria Idosa aceito.")).toBeInTheDocument();
    await screen.findByText("Saúde", { selector: "li" });
    expect(nomes()).toEqual([
      "Início",
      "Meu Perfil",
      "Saúde",
      "Medicamentos",
      "Agenda",
      "Alimentação e Nutrição",
      "Cuidadores",
      "Orientações",
    ]);
  });
});
