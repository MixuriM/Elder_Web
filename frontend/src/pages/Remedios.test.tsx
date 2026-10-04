import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Remedios from "./Remedios";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

// Item 5.2: a página passou a consultar os vínculos (GET /vinculo) ao montar. Aqui a consulta é mockada
// (default: familiar aprovado) para não entrar na contagem de fetch dos testes do 5.1, que seguem iguais.
const mockBuscarPermissoes = jest.fn();
jest.mock("../lib/permissoesSaude", () => ({
  ...jest.requireActual("../lib/permissoesSaude"),
  buscarPermissoesSaude: (...args: unknown[]) => mockBuscarPermissoes(...args),
}));

// Item 5.4: o download em si (fetch, Blob, <a download>) é testado em lib/baixarPdf.test.ts; aqui o helper
// é mockado e se confere o caminho pedido, o estado de carregamento e as mensagens.
const mockBaixarPdf = jest.fn();
jest.mock("../lib/baixarPdf", () => ({
  baixarPdf: (...args: unknown[]) => mockBaixarPdf(...args),
}));

type VinculoFake = {
  tipo_vinculo: "cuidador" | "familiar";
  status: string;
  papel_do_chamador: "dono" | "vinculado" | "titular";
  permissoes: { permite_registrar_saude: boolean; permite_marcar_dose: boolean; permite_criar_evento_cuidado: boolean } | null;
};
const FAMILIAR_APROVADO: VinculoFake = { tipo_vinculo: "familiar", status: "aprovado", papel_do_chamador: "vinculado", permissoes: null };
function cuidador(over: Partial<VinculoFake["permissoes"] & object> = {}, extra: Partial<VinculoFake> = {}): VinculoFake {
  return {
    tipo_vinculo: "cuidador",
    status: "aprovado",
    papel_do_chamador: "vinculado",
    permissoes: { permite_registrar_saude: false, permite_marcar_dose: false, permite_criar_evento_cuidado: false, ...over },
    ...extra,
  };
}

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
  mockBuscarPermissoes.mockReset();
  mockBuscarPermissoes.mockResolvedValue([FAMILIAR_APROVADO]);
  mockBaixarPdf.mockReset();
  mockBaixarPdf.mockResolvedValue(undefined);
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

// Item 5.2 (RF-012): seções "Marcar dose". Valores abaixo são obviamente falsos, só para teste.
const OBS_SIGILOSA = "obs-dose-falsa-sigilosa";

function secaoDose(sufixo: "idoso" | "vinculado") {
  return {
    idosoId: sufixo === "vinculado" ? screen.getByLabelText("Id do idoso (dose, vinculado)", { exact: true }) : null,
    medicamentoId: screen.getByLabelText(`Id do medicamento (dose, ${sufixo})`, { exact: true }),
    status: screen.getByLabelText(`Situação da dose (${sufixo})`, { exact: true }),
    dataHora: screen.getByLabelText(`Data e hora (opcional, ${sufixo})`, { exact: true }),
    obs: screen.getByLabelText(`Observações da dose (opcional, ${sufixo})`, { exact: true }),
    botao: screen.getByRole("button", { name: new RegExp(`^marcar dose \\(${sufixo}\\)$`, "i") }),
  };
}

async function renderComSecaoVinculado() {
  render(<Remedios />);
  await screen.findByRole("heading", { name: "Marcar dose de um idoso vinculado" });
}

describe("Remedios (item 5.2): marcar dose", () => {
  it("a seção do idoso renderiza sempre, com campos acessíveis por label", async () => {
    mockBuscarPermissoes.mockResolvedValue([]);
    render(<Remedios />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Marcar dose (só idoso)" })).toBeInTheDocument();
    Object.values(secaoDose("idoso")).forEach((el) => el && expect(el).toBeInTheDocument());
    expect(secaoDose("idoso").status).toHaveValue("administrado");
  });

  it("idoso: POST /remedios/{id}/doses com Authorization e confirmação em role=status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 55 }));
    const user = userEvent.setup();
    render(<Remedios />);
    await act(async () => {});
    const c = secaoDose("idoso");
    await user.type(c.medicamentoId, "9");
    await user.selectOptions(c.status, "pulado");
    await user.click(c.botao);

    expect(await screen.findByRole("status")).toHaveTextContent("Dose registrada (id 55).");
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/remedios\/9\/doses$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).toEqual({ status_administracao: "pulado" });
  });

  it("data e hora digitadas viram ISO com Z; observações preenchidas são enviadas", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 56 }));
    const user = userEvent.setup();
    render(<Remedios />);
    await act(async () => {});
    const c = secaoDose("idoso");
    await user.type(c.medicamentoId, "9");
    fireEvent.change(c.dataHora, { target: { value: "2026-10-02T08:30" } });
    await user.type(c.obs, "obs falsa");
    await user.click(c.botao);

    await screen.findByRole("status");
    const { corpo } = chamada();
    expect(corpo.data_hora_administracao).toBe(new Date("2026-10-02T08:30").toISOString());
    expect(corpo.observacoes).toBe("obs falsa");
  });

  it("vinculado (familiar aprovado): POST /remedios/idoso/{id}/{med}/doses com os ids digitados", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 57 }));
    const user = userEvent.setup();
    await renderComSecaoVinculado();
    const c = secaoDose("vinculado");
    await user.type(c.idosoId!, "7");
    await user.type(c.medicamentoId, "9");
    await user.click(c.botao);

    expect(await screen.findByRole("status")).toHaveTextContent("Dose registrada (id 57).");
    const { url, corpo } = chamada();
    expect(url).toMatch(/\/remedios\/idoso\/7\/9\/doses$/);
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo).not.toHaveProperty("registrado_por_id");
  });

  describe("visibilidade da seção do vinculado", () => {
    it("aparece para cuidador aprovado com permite_marcar_dose, sem aviso", async () => {
      mockBuscarPermissoes.mockResolvedValue([cuidador({ permite_marcar_dose: true })]);
      await renderComSecaoVinculado();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("não aparece para cuidador aprovado só com as outras flags e mostra aviso em role=status", async () => {
      mockBuscarPermissoes.mockResolvedValue([cuidador({ permite_registrar_saude: true, permite_criar_evento_cuidado: true })]);
      render(<Remedios />);
      expect(await screen.findByRole("status")).toHaveTextContent(/não tem permissão para marcar dose/i);
      expect(screen.queryByRole("heading", { name: "Marcar dose de um idoso vinculado" })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Marcar dose (só idoso)" })).toBeInTheDocument();
    });

    it("não aparece para cuidador com a flag mas vínculo pendente", async () => {
      mockBuscarPermissoes.mockResolvedValue([cuidador({ permite_marcar_dose: true }, { status: "pendente" })]);
      render(<Remedios />);
      await waitFor(() => expect(mockBuscarPermissoes).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByRole("heading", { name: "Marcar dose de um idoso vinculado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it.each(["dono", "titular"] as const)("papel %s não conta, mesmo aprovado e com a flag", async (papel) => {
      mockBuscarPermissoes.mockResolvedValue([
        { ...cuidador({ permite_marcar_dose: true }), papel_do_chamador: papel },
        { ...FAMILIAR_APROVADO, papel_do_chamador: papel },
      ]);
      render(<Remedios />);
      await waitFor(() => expect(mockBuscarPermissoes).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByRole("heading", { name: "Marcar dose de um idoso vinculado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("sem nenhum vínculo: sem seção e sem aviso", async () => {
      mockBuscarPermissoes.mockResolvedValue([]);
      render(<Remedios />);
      await act(async () => {});
      expect(screen.queryByRole("heading", { name: "Marcar dose de um idoso vinculado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("se a consulta de vínculos falhar, a seção aparece e o 403 do backend decide", async () => {
      mockBuscarPermissoes.mockRejectedValue(new Error("falha"));
      await renderComSecaoVinculado();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe.each(["idoso", "vinculado"] as const)("seção %s", (sufixo) => {
    async function preparar() {
      const user = userEvent.setup();
      await renderComSecaoVinculado();
      const c = secaoDose(sufixo);
      if (c.idosoId) await user.type(c.idosoId, "7");
      await user.type(c.medicamentoId, "9");
      await user.type(c.obs, OBS_SIGILOSA);
      return { user, c };
    }

    it.each([
      [403, "Sem permissão para registrar dose."],
      [400, "status_administracao inválido."],
      [404, "Medicamento não encontrado."],
      [409, "Medicamento inativo."],
    ])("%i aparece em role=alert, sem sucesso e sem ecoar o que foi digitado", async (status, mensagem) => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: mensagem }));
      const espiao = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { user, c } = await preparar();
      await user.click(c.botao);

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent(mensagem);
      expect(alerta).not.toHaveTextContent(OBS_SIGILOSA);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(JSON.stringify(espiao.mock.calls)).not.toContain(OBS_SIGILOSA);
    });

    it("durante o envio o botão fica indisponível e não há duplo envio", async () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
      const { user, c } = await preparar();
      await user.click(c.botao);

      const ocupado = await screen.findByRole("button", { name: /marcando/i });
      expect(ocupado).toBeDisabled();
      expect(ocupado).toHaveAttribute("aria-busy", "true");
      await user.click(ocupado);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("não escreve nada em console.* nem com sucesso", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 58 }));
      const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
        jest.spyOn(console, m).mockImplementation(() => undefined),
      );
      const { user, c } = await preparar();
      await user.click(c.botao);
      await screen.findByRole("status");
      expect(JSON.stringify(espioes.flatMap((e) => e.mock.calls))).not.toContain(OBS_SIGILOSA);
    });
  });
});


// Item 5.3 (RF-013): seção crua "Ver histórico de remédios" (GET /remedios e GET /remedios/idoso/:id).
// Valores abaixo são obviamente falsos, só para teste. Datas YYYY-MM-DD saem por split (sem new Date) e a hora
// da dose sai em America/Sao_Paulo fixo, para o teste ser determinístico em qualquer fuso da máquina.
const HISTORICO = {
  medicamentos: [
    {
      id: 1,
      idoso_id: 5,
      criado_por_id: 5,
      nome: "Remedio Historico Um",
      dosagem: "10 mg",
      frequencia: "2x ao dia",
      data_inicio: "2026-03-01",
      data_fim: null,
      observacoes: "obs do medicamento falsa",
      ativo: true,
      editado_por_id: null,
      doses: [
        { id: 3, medicamento_id: 1, registrado_por_id: 5, data_hora_administracao: "2026-09-14T12:30:00.000Z", status_administracao: "administrado", observacoes: "obs da dose falsa" },
        { id: 2, medicamento_id: 1, registrado_por_id: 5, data_hora_administracao: "2026-09-12T11:00:00.000Z", status_administracao: "pulado", observacoes: null },
        { id: 1, medicamento_id: 1, registrado_por_id: 5, data_hora_administracao: "2026-09-10T22:15:00.000Z", status_administracao: "atrasado", observacoes: null },
      ],
    },
    {
      id: 2,
      idoso_id: 5,
      criado_por_id: 5,
      nome: "Remedio Historico Dois",
      dosagem: "5 ml",
      frequencia: "1x ao dia",
      data_inicio: "2026-01-31",
      data_fim: "2026-12-31",
      observacoes: null,
      ativo: false,
      editado_por_id: null,
      doses: [],
    },
  ],
};

function secaoHistorico() {
  return {
    idoso: screen.getByLabelText("Id do idoso (vazio = meu histórico)", { exact: true }),
    botao: screen.getByRole("button", { name: /^ver histórico$/i }),
  };
}

describe("Remedios: histórico de remédios (item 5.3)", () => {
  it("seção sempre visível, com título, campo por label e botão (mesmo sem vínculo)", async () => {
    mockBuscarPermissoes.mockResolvedValue([]);
    render(<Remedios />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Ver histórico de remédios" })).toBeInTheDocument();
    const s = secaoHistorico();
    expect(s.idoso).toHaveAttribute("type", "number");
    expect(s.botao).toBeEnabled();
  });

  it("id vazio: GET /remedios com Authorization e sem corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, HISTORICO));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);

    expect(await screen.findByRole("status")).toHaveTextContent("2 medicamento(s) encontrado(s).");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/remedios$/);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(init.body).toBeUndefined();
  });

  it("id preenchido: GET /remedios/idoso/:id", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, HISTORICO));
    const user = userEvent.setup();
    render(<Remedios />);
    const s = secaoHistorico();
    await user.type(s.idoso, "7");
    await user.click(s.botao);

    await screen.findByRole("status");
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toMatch(/\/remedios\/idoso\/7$/);
  });

  it("mostra nome, dosagem, frequência, datas sem deslocar o dia, situação e observações", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, HISTORICO));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);
    await screen.findByRole("status");

    const um = screen.getByRole("heading", { name: "Remedio Historico Um" }).closest("li") as HTMLElement;
    expect(um).toHaveTextContent("10 mg");
    expect(um).toHaveTextContent("2x ao dia");
    expect(um).toHaveTextContent("Início: 01/03/2026");
    expect(um).toHaveTextContent("Sem data de término");
    expect(um).toHaveTextContent("Situação: Ativo");
    expect(um).toHaveTextContent("obs do medicamento falsa");

    const dois = screen.getByRole("heading", { name: "Remedio Historico Dois" }).closest("li") as HTMLElement;
    expect(dois).toHaveTextContent("Início: 31/01/2026");
    expect(dois).toHaveTextContent("Fim: 31/12/2026");
    expect(dois).not.toHaveTextContent("Sem data de término");
    expect(dois).toHaveTextContent("Situação: Inativo");
    expect(dois).not.toHaveTextContent("Observações");
  });

  it("doses: dd/mm/aaaa HH:mm em America/Sao_Paulo, texto de cada status e observações, na ordem recebida", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, HISTORICO));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);
    await screen.findByRole("status");

    const um = screen.getByRole("heading", { name: "Remedio Historico Um" }).closest("li") as HTMLElement;
    const doses = within(within(um).getByRole("list")).getAllByRole("listitem");
    expect(doses).toHaveLength(3);
    expect(doses[0]).toHaveTextContent("14/09/2026 09:30, Administrado");
    expect(doses[0]).toHaveTextContent("obs da dose falsa");
    expect(doses[1]).toHaveTextContent("12/09/2026 08:00, Pulado");
    expect(doses[2]).toHaveTextContent("10/09/2026 19:15, Atrasado");
  });

  it("medicamento sem doses mostra 'Nenhuma dose registrada.'", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, HISTORICO));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);
    await screen.findByRole("status");

    const dois = screen.getByRole("heading", { name: "Remedio Historico Dois" }).closest("li") as HTMLElement;
    expect(dois).toHaveTextContent("Nenhuma dose registrada.");
    const um = screen.getByRole("heading", { name: "Remedio Historico Um" }).closest("li") as HTMLElement;
    expect(um).not.toHaveTextContent("Nenhuma dose registrada.");
  });

  it("lista vazia: 'Nenhum medicamento cadastrado.' e nenhum item", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { medicamentos: [] }));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);

    expect(await screen.findByRole("status")).toHaveTextContent("Nenhum medicamento cadastrado.");
    expect(screen.queryByRole("heading", { name: /Remedio Historico/ })).not.toBeInTheDocument();
  });

  it("erro 403 aparece em role=alert com a mensagem da API e sem resultado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(403, { error: "Sem permissão para visualizar histórico de remédios." }));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para visualizar histórico de remédios.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("durante a chamada o botão vira 'Carregando...' e fica desabilitado", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);

    const ocupado = await screen.findByRole("button", { name: /carregando/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
  });

  it("nova busca limpa o resultado anterior", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, HISTORICO)).mockResolvedValueOnce(respostaJson(403, { error: "Negado de teste." }));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);
    await screen.findByRole("status");
    await user.click(secaoHistorico().botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Negado de teste.");
    expect(screen.queryByRole("heading", { name: "Remedio Historico Um" })).not.toBeInTheDocument();
  });

  it("não escreve em console.* nem no sucesso nem no erro (dado sensível)", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, HISTORICO)).mockResolvedValueOnce(respostaJson(500, { error: "Falha de teste." }));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoHistorico().botao);
    await screen.findByRole("status");
    await user.click(secaoHistorico().botao);
    await screen.findByRole("alert");
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });
});

// Item 5.4 (RF-014): seção crua "Exportar histórico em PDF". Id do idoso em branco = idoso exporta o próprio
// (GET /historico/pdf); preenchido = cuidador/familiar (GET /historico/idoso/:id/pdf).
function secaoExportar() {
  return {
    idoso: screen.getByLabelText("Id do idoso para exportar (vazio = meu histórico)", { exact: true }),
    botao: screen.getByRole("button", { name: /^baixar histórico em pdf$/i }),
  };
}

describe("Remedios: exportar histórico em PDF (item 5.4)", () => {
  it("seção sempre visível, com título, campo por label e botão (mesmo sem vínculo)", async () => {
    mockBuscarPermissoes.mockResolvedValue([]);
    render(<Remedios />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Exportar histórico em PDF" })).toBeInTheDocument();
    const c = secaoExportar();
    expect(c.idoso).toHaveAttribute("type", "number");
    expect(c.botao).toBeEnabled();
  });

  it("id vazio: exporta o próprio (/historico/pdf)", async () => {
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    await screen.findByRole("status");
    expect(mockBaixarPdf).toHaveBeenCalledTimes(1);
    expect(mockBaixarPdf).toHaveBeenCalledWith("/historico/pdf");
  });

  it("id preenchido: exporta do vinculado (/historico/idoso/:id/pdf)", async () => {
    const user = userEvent.setup();
    render(<Remedios />);
    await user.type(secaoExportar().idoso, "7");
    await user.click(secaoExportar().botao);
    await screen.findByRole("status");
    expect(mockBaixarPdf).toHaveBeenCalledWith("/historico/idoso/7/pdf");
  });

  it("durante a geração o botão fica indisponível, com aria-busy, e não há duplo envio", async () => {
    mockBaixarPdf.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);

    const ocupado = await screen.findByRole("button", { name: /gerando pdf/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
    await user.click(ocupado);
    expect(mockBaixarPdf).toHaveBeenCalledTimes(1);
  });

  it("sucesso em role=status e sem alerta", async () => {
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    expect(await screen.findByRole("status")).toHaveTextContent("PDF gerado. O download começou.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(secaoExportar().botao).toBeEnabled();
    expect(secaoExportar().botao).toHaveAttribute("aria-busy", "false");
  });

  it("erro do backend em role=alert com a mensagem dele e sem sucesso", async () => {
    mockBaixarPdf.mockRejectedValue(new Error("Sem permissão para exportar histórico."));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para exportar histórico.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(secaoExportar().botao).toBeEnabled();
  });

  it("erro sem mensagem usa texto padrão", async () => {
    mockBaixarPdf.mockRejectedValue("falha qualquer");
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao gerar o PDF.");
  });

  it("reenviar limpa a mensagem anterior (erro some ao reenviar; sucesso some ao reenviar)", async () => {
    mockBaixarPdf.mockRejectedValueOnce(new Error("Erro de teste.")).mockResolvedValueOnce(undefined).mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(secaoExportar().botao); // segundo envio: sucesso
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(secaoExportar().botao); // terceiro envio: pendente
    await screen.findByRole("button", { name: /gerando pdf/i });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não escreve em console.* nem no sucesso nem no erro (dado sensível)", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    mockBaixarPdf.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Falha de teste."));
    const user = userEvent.setup();
    render(<Remedios />);
    await user.click(secaoExportar().botao);
    await screen.findByRole("status");
    await user.click(secaoExportar().botao);
    await screen.findByRole("alert");
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });
});

// Item 5.x (D12): feedback ao marcar dose. Envio ocupado, sucesso em role=status e erro em role=alert já têm
// teste no describe do 5.2; faltava a mensagem anterior limpa ao reenviar, nas duas seções.
describe("Remedios: feedback ao marcar dose, mensagem anterior limpa ao reenviar", () => {
  it.each(["idoso", "vinculado"] as const)("seção %s: erro e sucesso somem ao reenviar", async (sufixo) => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(409, { error: "Medicamento inativo." }))
      .mockResolvedValueOnce(respostaJson(201, { id: 77 }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Remedios />);
    await screen.findByRole("heading", { name: "Marcar dose de um idoso vinculado" });
    const c = secaoDose(sufixo);
    if (c.idosoId) await user.type(c.idosoId, "7");
    await user.type(c.medicamentoId, "9");

    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Medicamento inativo.");

    await user.click(c.botao);
    expect(await screen.findByRole("status")).toHaveTextContent("Dose registrada (id 77).");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(c.botao);
    expect(await screen.findByRole("button", { name: /marcando/i })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
