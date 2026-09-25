import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Saude from "./Saude";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response;
}

// Item 4.1 (RF-007): esqueleto cru da página /saude, formulário "Registrar leitura de saúde".
describe("Saude — Registrar leitura de saúde (item 4.1)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function renderESecao() {
    render(<Saude />);
    return {
      tipo: screen.getByLabelText("Tipo de medição", { exact: true }),
      valor1: screen.getByLabelText("Valor 1", { exact: true }),
      valor2: screen.getByLabelText("Valor 2 (opcional)", { exact: true }),
      unidade: screen.getByLabelText("Unidade", { exact: true }),
      dataHora: screen.getByLabelText("Data e hora (opcional)", { exact: true }),
      obs: screen.getByLabelText("Observações (opcional)", { exact: true }),
      botao: screen.getByRole("button", { name: /^registrar leitura$/i }),
    };
  }

  it("campos acessíveis por label", () => {
    const c = renderESecao();
    Object.values(c).forEach((el) => expect(el).toBeInTheDocument());
  });

  it("envia POST /saude com Authorization e valores numéricos, sem campos de autoria", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 55 }));
    const user = userEvent.setup();
    const c = renderESecao();

    await user.type(c.tipo, "pressao");
    await user.type(c.valor1, "120");
    await user.type(c.valor2, "80");
    await user.type(c.unidade, "mmHg");
    fireEvent.change(c.dataHora, { target: { value: "2026-09-23T10:00" } });
    await user.click(c.botao);

    await screen.findByText(/id 55/);
    const [url, opcoes] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/saude$/);
    expect(opcoes.method).toBe("POST");
    expect(opcoes.headers.Authorization).toBe("Bearer token-fake");
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.valor_1).toBe(120);
    expect(corpo.valor_2).toBe(80);
    expect(typeof corpo.valor_1).toBe("number");
    expect(corpo.data_hora).toBe(new Date("2026-09-23T10:00").toISOString());
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo).not.toHaveProperty("registrado_por_id");
    expect(corpo).not.toHaveProperty("editado_por_id");
  });

  it("sucesso mostra o id do registro, sem alerta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 55 }));
    const user = userEvent.setup();
    const c = renderESecao();
    await user.type(c.tipo, "peso");
    await user.type(c.valor1, "70.5");
    await user.type(c.unidade, "kg");
    await user.click(c.botao);

    expect(await screen.findByText(/Leitura registrada \(id 55\)/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [400, "valor_1 inválido."],
    [403, "Sem permissão para registrar leitura de saúde."],
  ])("erro %i aparece com role=alert", async (status, mensagem) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: mensagem }));
    const user = userEvent.setup();
    const c = renderESecao();
    await user.type(c.tipo, "peso");
    await user.type(c.valor1, "70");
    await user.type(c.unidade, "kg");
    await user.click(c.botao);

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
  });

  it("console.error não recebe valores de saúde", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "valor_1 inválido." }));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const user = userEvent.setup();
      const c = renderESecao();
      await user.type(c.tipo, "pressao");
      await user.type(c.valor1, "123.45");
      await user.type(c.unidade, "mmHg");
      await user.type(c.obs, "segredo-clinico");
      await user.click(c.botao);
      await screen.findByRole("alert");
      const tudo = JSON.stringify(spy.mock.calls.map((c) => c.map((a) => (a instanceof Error ? a.message : a))));
      expect(tudo).not.toContain("123.45");
      expect(tudo).not.toContain("segredo-clinico");
    } finally {
      spy.mockRestore();
    }
  });
});

// Item 4.2 (RF-008): segunda seção, cuidador registra leitura de um idoso vinculado.
describe("Saude: registrar leitura de um idoso (cuidador, item 4.2)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function renderESecao() {
    render(<Saude />);
    return {
      idoso: screen.getByLabelText("Id do idoso", { exact: true }),
      tipo: screen.getByLabelText("Tipo de medição (cuidador)", { exact: true }),
      valor1: screen.getByLabelText("Valor 1 (cuidador)", { exact: true }),
      valor2: screen.getByLabelText("Valor 2 (opcional, cuidador)", { exact: true }),
      unidade: screen.getByLabelText("Unidade (cuidador)", { exact: true }),
      dataHora: screen.getByLabelText("Data e hora (opcional, cuidador)", { exact: true }),
      obs: screen.getByLabelText("Observações (opcional, cuidador)", { exact: true }),
      botao: screen.getByRole("button", { name: /^registrar leitura do idoso$/i }),
    };
  }

  async function preencher(c: ReturnType<typeof renderESecao>, user: ReturnType<typeof userEvent.setup>) {
    await user.type(c.idoso, "5");
    await user.type(c.tipo, "pressao");
    await user.type(c.valor1, "123.45");
    await user.type(c.unidade, "mmHg");
  }

  it("a seção renderiza com campos acessíveis por label", () => {
    const c = renderESecao();
    Object.values(c).forEach((el) => expect(el).toBeInTheDocument());
  });

  it("envia POST /saude/idoso/:id com números e data ISO, sem campos de autoria", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 77 }));
    const user = userEvent.setup();
    const c = renderESecao();
    await preencher(c, user);
    await user.type(c.valor2, "80");
    fireEvent.change(c.dataHora, { target: { value: "2026-09-24T10:00" } });
    await user.click(c.botao);

    expect(await screen.findByText(/Leitura do idoso registrada \(id 77\)/)).toBeInTheDocument();
    const [url, opcoes] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/saude\/idoso\/5$/);
    expect(opcoes.method).toBe("POST");
    expect(opcoes.headers.Authorization).toBe("Bearer token-fake");
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.valor_1).toBe(123.45);
    expect(corpo.valor_2).toBe(80);
    expect(corpo.data_hora).toBe(new Date("2026-09-24T10:00").toISOString());
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo).not.toHaveProperty("registrado_por_id");
    expect(corpo).not.toHaveProperty("editado_por_id");
  });

  it("erro 403 do backend aparece com role=alert", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(403, { error: "Sem permissão para registrar leitura de saúde." }),
    );
    const user = userEvent.setup();
    const c = renderESecao();
    await preencher(c, user);
    await user.click(c.botao);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para registrar leitura de saúde.");
  });

  it("botão fica desabilitado durante a chamada", async () => {
    let resolver!: (r: Response) => void;
    (global.fetch as jest.Mock).mockReturnValue(new Promise<Response>((r) => (resolver = r)));
    const user = userEvent.setup();
    const c = renderESecao();
    await preencher(c, user);
    await user.click(c.botao);

    await waitFor(() => expect(c.botao).toBeDisabled());
    expect(c.botao).toHaveAttribute("aria-busy", "true");
    resolver(respostaJson(201, { id: 1 }));
    await waitFor(() => expect(c.botao).toBeEnabled());
  });

  it("console.error não recebe valores de saúde", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(403, { error: "Sem permissão para registrar leitura de saúde." }),
    );
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const user = userEvent.setup();
      const c = renderESecao();
      await preencher(c, user);
      await user.type(c.obs, "segredo-clinico-ficticio");
      await user.click(c.botao);
      await screen.findByRole("alert");
      const tudo = JSON.stringify(spy.mock.calls.map((a) => a.map((x) => (x instanceof Error ? x.message : x))));
      expect(tudo).not.toContain("123.45");
      expect(tudo).not.toContain("segredo-clinico-ficticio");
    } finally {
      spy.mockRestore();
    }
  });
});

// Item 4.2b (RF-007, RF-009): a seção "de um idoso" também serve o familiar.
describe("Saude: registrar leitura de um idoso (familiar, item 4.2b)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  async function enviar(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Id do idoso", { exact: true }), "5");
    await user.type(screen.getByLabelText("Tipo de medição (cuidador)", { exact: true }), "pressao");
    await user.type(screen.getByLabelText("Valor 1 (cuidador)", { exact: true }), "120");
    await user.type(screen.getByLabelText("Unidade (cuidador)", { exact: true }), "mmHg");
    await user.click(screen.getByRole("button", { name: /^registrar leitura do idoso$/i }));
  }

  it("o título da seção indica cuidador ou familiar", () => {
    render(<Saude />);
    expect(screen.getByRole("heading", { name: /^registrar .*idoso \(cuidador ou familiar\)/i })).toBeInTheDocument();
  });

  it("sucesso do familiar: envia para /saude/idoso/:id e mostra o id registrado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 42, registrado_por_id: 20 }));
    render(<Saude />);
    await enviar(userEvent.setup());
    expect(await screen.findByText(/Leitura do idoso registrada \(id 42\)/)).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/saude\/idoso\/5$/);
  });

  it("403 (idoso com autoridade) aparece com role=alert, sem sucesso na tela", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(403, { error: "Sem permissão para registrar leitura de saúde." }),
    );
    render(<Saude />);
    await enviar(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para registrar leitura de saúde.");
    expect(screen.queryByText(/Leitura do idoso registrada/)).not.toBeInTheDocument();
  });
});

// Item 4.3 (RF-009, RNF-006): seções de edição (PATCH /saude/:id e PATCH /saude/idoso/:idosoId/:id).
describe.each([
  ["idoso (próprio)", "edição", false, /\/saude\/9$/],
  ["cuidador ou familiar", "edição, idoso vinculado", true, /\/saude\/idoso\/5\/9$/],
] as const)("Saude: editar registro, %s (item 4.3)", (_nome, sufixo, comIdoso, urlEsperada) => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function campos() {
    const l = (r: string) => screen.getByLabelText(`${r} (${sufixo})`, { exact: true });
    return {
      idoso: comIdoso ? l("Id do idoso") : null,
      registro: l("Id do registro"),
      tipo: l("Tipo de medição"),
      valor1: l("Valor 1"),
      valor2: screen.getByLabelText(`Valor 2 (opcional, ${sufixo})`, { exact: true }),
      unidade: l("Unidade"),
      dataHora: screen.getByLabelText(`Data e hora (opcional, ${sufixo})`, { exact: true }),
      obs: screen.getByLabelText(`Observações (opcional, ${sufixo})`, { exact: true }),
      botao: screen.getByRole("button", { name: `Salvar edição (${sufixo})` }),
    };
  }

  async function preencher(c: ReturnType<typeof campos>, user: ReturnType<typeof userEvent.setup>) {
    if (c.idoso) await user.type(c.idoso, "5");
    await user.type(c.registro, "9");
    await user.type(c.tipo, "pressao");
    await user.type(c.valor1, "123.45");
    await user.type(c.unidade, "mmHg");
  }

  it("campos acessíveis por label", () => {
    render(<Saude />);
    Object.values(campos()).forEach((el) => el && expect(el).toBeInTheDocument());
  });

  it("envia PATCH para a URL certa, com números e sem campos de autoria", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { id: 9 }));
    const user = userEvent.setup();
    render(<Saude />);
    const c = campos();
    await preencher(c, user);
    await user.type(c.valor2, "80");
    fireEvent.change(c.dataHora, { target: { value: "2026-09-25T10:00" } });
    await user.click(c.botao);

    expect(await screen.findByText(/Registro atualizado \(id 9\)/)).toBeInTheDocument();
    const [url, opcoes] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(urlEsperada);
    expect(opcoes.method).toBe("PATCH");
    expect(opcoes.headers.Authorization).toBe("Bearer token-fake");
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.valor_1).toBe(123.45);
    expect(corpo.valor_2).toBe(80);
    expect(corpo.data_hora).toBe(new Date("2026-09-25T10:00").toISOString());
    for (const k of ["id", "idoso_id", "registrado_por_id", "editado_por_id"]) expect(corpo).not.toHaveProperty(k);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("edição parcial: só valor_1 preenchido envia só valor_1, sem default nos demais", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { id: 9 }));
    const user = userEvent.setup();
    render(<Saude />);
    const c = campos();
    if (c.idoso) await user.type(c.idoso, "5");
    await user.type(c.registro, "9");
    await user.type(c.valor1, "150");
    await user.click(c.botao);

    await screen.findByText(/Registro atualizado \(id 9\)/);
    const corpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(corpo).toEqual({ valor_1: 150 });
  });

  it("enviar sem alterar nenhum campo manda corpo vazio e mostra o 400 do backend com role=alert", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(400, { error: "Nenhum campo de leitura informado." }),
    );
    const user = userEvent.setup();
    render(<Saude />);
    const c = campos();
    if (c.idoso) await user.type(c.idoso, "5");
    await user.type(c.registro, "9");
    await user.click(c.botao);

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhum campo de leitura informado.");
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({});
    expect(screen.queryByText(/Registro atualizado/)).not.toBeInTheDocument();
  });

  it("botão fica desabilitado durante a chamada", async () => {
    let resolver!: (r: Response) => void;
    (global.fetch as jest.Mock).mockReturnValue(new Promise<Response>((r) => (resolver = r)));
    const user = userEvent.setup();
    render(<Saude />);
    const c = campos();
    await preencher(c, user);
    await user.click(c.botao);

    await waitFor(() => expect(c.botao).toBeDisabled());
    expect(c.botao).toHaveAttribute("aria-busy", "true");
    resolver(respostaJson(200, { id: 9 }));
    await waitFor(() => expect(c.botao).toBeEnabled());
  });

  it("erro 403 aparece com role=alert, sem sucesso na tela", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(403, { error: "Sem permissão para editar registro de saúde." }),
    );
    const user = userEvent.setup();
    render(<Saude />);
    await preencher(campos(), user);
    await user.click(campos().botao);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para editar registro de saúde.");
    expect(screen.queryByText(/Registro atualizado/)).not.toBeInTheDocument();
  });

  it("console.error não recebe valores de saúde", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(403, { error: "Sem permissão para editar registro de saúde." }),
    );
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const user = userEvent.setup();
      render(<Saude />);
      const c = campos();
      await preencher(c, user);
      await user.type(c.obs, "segredo-clinico-ficticio");
      await user.click(c.botao);
      await screen.findByRole("alert");
      const tudo = JSON.stringify(spy.mock.calls.map((a) => a.map((x) => (x instanceof Error ? x.message : x))));
      expect(tudo).not.toContain("123.45");
      expect(tudo).not.toContain("segredo-clinico-ficticio");
    } finally {
      spy.mockRestore();
    }
  });
});
