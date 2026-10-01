import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Remedios from "./Remedios";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Item 5.1 (RF-011): esqueleto cru da página /remedios, só para exercitar POST /remedios e
// POST /remedios/idoso/:idosoId. Valores abaixo são obviamente falsos, só para teste.
const NOME = "medicamento-falso-sigiloso";

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

function secao(sufixo: "idoso" | "familiar") {
  return {
    idosoId: sufixo === "familiar" ? screen.getByLabelText("Id do idoso (familiar)", { exact: true }) : null,
    nome: screen.getByLabelText(`Nome (${sufixo})`, { exact: true }),
    dosagem: screen.getByLabelText(`Dosagem (${sufixo})`, { exact: true }),
    frequencia: screen.getByLabelText(`Frequência (${sufixo})`, { exact: true }),
    inicio: screen.getByLabelText(`Data de início (${sufixo})`, { exact: true }),
    fim: screen.getByLabelText(`Data de fim (opcional, ${sufixo})`, { exact: true }),
    obs: screen.getByLabelText(`Observações (opcional, ${sufixo})`, { exact: true }),
    botao: screen.getByRole("button", { name: new RegExp(`^cadastrar medicamento \\(${sufixo}\\)$`, "i") }),
  };
}

async function preencherObrigatorios(c: ReturnType<typeof secao>, user: ReturnType<typeof userEvent.setup>, nome = "Remedio Ficticio") {
  await user.type(c.nome, nome);
  await user.type(c.dosagem, "10 mg");
  await user.type(c.frequencia, "2x ao dia");
  fireEvent.change(c.inicio, { target: { value: "2026-10-01" } });
}

function chamada(i = 0) {
  const [url, init] = (global.fetch as jest.Mock).mock.calls[i];
  return { url: String(url), init, corpo: JSON.parse(init.body) };
}

describe("Remedios (item 5.1)", () => {
  it("seções e campos acessíveis por label", () => {
    render(<Remedios />);
    expect(screen.getByRole("heading", { name: "Cadastrar medicamento (só idoso)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cadastrar medicamento de um idoso (familiar)" })).toBeInTheDocument();
    for (const s of ["idoso", "familiar"] as const) {
      Object.values(secao(s)).forEach((el) => el && expect(el).toBeInTheDocument());
    }
  });

  it("campos de texto trazem maxLength 150, 50, 100 e 500", () => {
    render(<Remedios />);
    const c = secao("idoso");
    expect(c.nome).toHaveAttribute("maxLength", "150");
    expect(c.dosagem).toHaveAttribute("maxLength", "50");
    expect(c.frequencia).toHaveAttribute("maxLength", "100");
    expect(c.obs).toHaveAttribute("maxLength", "500");
  });

  it("idoso: POST /remedios com Authorization, data YYYY-MM-DD direto e opcionais em branco omitidos", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("idoso");
    await preencherObrigatorios(c, user);
    await user.click(c.botao);

    expect(await screen.findByRole("status")).toHaveTextContent("Medicamento cadastrado (id 31).");
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/remedios$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).toEqual({ nome: "Remedio Ficticio", dosagem: "10 mg", frequencia: "2x ao dia", data_inicio: "2026-10-01" });
  });

  it("idoso: opcionais preenchidos são enviados", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 32 }));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("idoso");
    await preencherObrigatorios(c, user);
    fireEvent.change(c.fim, { target: { value: "2026-12-31" } });
    await user.type(c.obs, "obs falsa");
    await user.click(c.botao);

    await screen.findByRole("status");
    expect(chamada().corpo).toMatchObject({ data_fim: "2026-12-31", observacoes: "obs falsa" });
  });

  it("erro do backend aparece em role=alert e não mostra sucesso", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(403, { error: "Sem permissão para cadastrar medicamento." }));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("idoso");
    await preencherObrigatorios(c, user);
    await user.click(c.botao);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para cadastrar medicamento.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("familiar: POST /remedios/idoso/{id} com o id digitado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 33 }));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("familiar");
    await user.type(c.idosoId!, "7");
    await preencherObrigatorios(c, user);
    await user.click(c.botao);

    expect(await screen.findByRole("status")).toHaveTextContent("Medicamento cadastrado (id 33).");
    const { url, corpo } = chamada();
    expect(url).toMatch(/\/remedios\/idoso\/7$/);
    expect(corpo).not.toHaveProperty("idoso_id");
  });

  it("console.error registra só a mensagem do erro, nunca o nome do medicamento digitado", async () => {
    const espiao = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "nome inválido." }));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("idoso");
    await preencherObrigatorios(c, user, NOME);
    await user.click(c.botao);

    await screen.findByRole("alert");
    expect(espiao).toHaveBeenCalled();
    expect(JSON.stringify(espiao.mock.calls)).not.toContain(NOME);
  });

  it("durante o carregamento o botão fica indisponível e não há duplo envio", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Remedios />);
    const c = secao("idoso");
    await preencherObrigatorios(c, user);
    await user.click(c.botao);

    const ocupado = await screen.findByRole("button", { name: /cadastrando/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
    await user.click(ocupado);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
