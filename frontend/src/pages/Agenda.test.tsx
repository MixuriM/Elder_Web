import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Agenda from "./Agenda";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Item 6.1 (RF-015): esqueleto cru da página /agenda, só para exercitar POST /agenda e
// POST /agenda/idoso/:idosoId. Valores abaixo são obviamente falsos, só para teste.
const TITULO = "compromisso-falso-sigiloso";
const INICIO_LOCAL = "2026-10-10T09:00";
const FIM_LOCAL = "2026-10-10T10:30";

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

function secao(sufixo: "idoso" | "familiar") {
  return {
    idosoId: sufixo === "familiar" ? screen.getByLabelText("Id do idoso (familiar)", { exact: true }) : null,
    tipo: screen.getByLabelText(`Tipo (${sufixo})`, { exact: true }) as HTMLSelectElement,
    titulo: screen.getByLabelText(`Título (${sufixo})`, { exact: true }),
    descricao: screen.getByLabelText(`Descrição (opcional, ${sufixo})`, { exact: true }),
    inicio: screen.getByLabelText(`Início (${sufixo})`, { exact: true }),
    fim: screen.getByLabelText(`Fim (opcional, ${sufixo})`, { exact: true }),
    botao: screen.getByRole("button", { name: new RegExp(`^criar compromisso \\(${sufixo}\\)$`, "i") }),
  };
}

async function preencher(c: ReturnType<typeof secao>, user: ReturnType<typeof userEvent.setup>, titulo = "Consulta Ficticia") {
  if (c.idosoId) await user.type(c.idosoId, "7");
  await user.type(c.titulo, titulo);
  fireEvent.change(c.inicio, { target: { value: INICIO_LOCAL } });
}

function chamada(i = 0) {
  const [url, init] = (global.fetch as jest.Mock).mock.calls[i];
  return { url: String(url), init, corpo: JSON.parse(init.body) };
}

describe("Agenda (item 6.1)", () => {
  it("renderiza os dois formulários com todos os campos acessíveis por label", () => {
    render(<Agenda />);
    expect(screen.getByRole("heading", { name: "Criar compromisso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar compromisso para um idoso vinculado" })).toBeInTheDocument();
    for (const s of ["idoso", "familiar"] as const) {
      Object.values(secao(s)).forEach((el) => el && expect(el).toBeInTheDocument());
    }
  });

  it.each(["idoso", "familiar"] as const)("select de tipo (%s) só tem Pessoal e Médico, sem 'cuidado'", (sufixo) => {
    render(<Agenda />);
    const opcoes = Array.from(secao(sufixo).tipo.options).map((o) => [o.value, o.textContent]);
    expect(opcoes).toEqual([
      ["pessoal", "Pessoal"],
      ["medico", "Médico"],
    ]);
    expect(screen.queryByRole("option", { name: /cuidado/i })).not.toBeInTheDocument();
  });

  it("campos trazem maxLength 150 (título) e 500 (descrição)", () => {
    render(<Agenda />);
    const c = secao("idoso");
    expect(c.titulo).toHaveAttribute("maxLength", "150");
    expect(c.descricao).toHaveAttribute("maxLength", "500");
  });

  it("idoso: POST /agenda com Authorization, início via toISOString e fim vazio omitido", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/agenda$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).toEqual({
      tipo_evento: "pessoal",
      titulo: "Consulta Ficticia",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
    });
    expect(corpo).not.toHaveProperty("data_hora_fim");
    expect(corpo).not.toHaveProperty("descricao");
  });

  it("idoso: tipo médico, descrição e fim preenchidos vão no corpo, fim via toISOString", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 32 }));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user);
    await user.selectOptions(c.tipo, "medico");
    await user.type(c.descricao, "Levar exames");
    fireEvent.change(c.fim, { target: { value: FIM_LOCAL } });
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(chamada().corpo).toEqual({
      tipo_evento: "medico",
      titulo: "Consulta Ficticia",
      descricao: "Levar exames",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
      data_hora_fim: new Date(FIM_LOCAL).toISOString(),
    });
  });

  it("familiar: POST /agenda/idoso/<id> com o id digitado no caminho, nunca no corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 33 }));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("familiar");
    await preencher(c, user);
    await user.click(c.botao);
    await screen.findByRole("status");
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/agenda\/idoso\/7$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo.tipo_evento).toBe("pessoal");
  });

  it("sucesso em role=status com o id criado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toHaveTextContent("Compromisso criado (id 41).");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([400, 403, 500])("erro %i em role=alert com a mensagem do servidor", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("familiar");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["idoso", "familiar"] as const)("durante o envio (%s): botão desabilitado e aria-busy", async (sufixo) => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao(sufixo);
    await preencher(c, user);
    await user.click(c.botao);
    const ocupado = await screen.findByRole("button", { name: /criando/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
  });

  it("limpa a mensagem anterior ao reenviar", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(400, { error: "Mensagem de erro de teste." }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(c.botao);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("limpa o sucesso anterior ao reenviar", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(201, { id: 5 }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    await user.click(c.botao);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("nunca loga o título nem o corpo enviado, nem no erro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "Mensagem de erro de teste." }));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    render(<Agenda />);
    const c = secao("idoso");
    await preencher(c, user, TITULO);
    await user.click(c.botao);
    await screen.findByRole("alert");
    expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain(TITULO);
  });
});
