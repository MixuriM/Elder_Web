import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Remedios from "./Remedios";

expect.extend(toHaveNoViolations);

// Item 5.1: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /remedios.
// LIMITE: jsdom não calcula layout nem cor, então contraste de cor NÃO é verificado aqui
// (regra color-contrast desligada de propósito, ver AXE). Contraste segue pendente para o item 9.1.
// Dados abaixo são valores obviamente falsos de teste.
const AXE = {
  rules: {
    // jsdom não renderiza estilos computados de cor: a regra não tem como dar resultado confiável.
    "color-contrast": { enabled: false },
  },
};

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

// Item 5.2: a página consulta os vínculos ao montar; a consulta é mockada (default: familiar aprovado)
// para as seções do 5.1 seguirem sem fetch extra.
const mockBuscarPermissoes = jest.fn();
jest.mock("../lib/permissoesSaude", () => ({
  ...jest.requireActual("../lib/permissoesSaude"),
  buscarPermissoesSaude: (...args: unknown[]) => mockBuscarPermissoes(...args),
}));
const FAMILIAR_APROVADO = { tipo_vinculo: "familiar", status: "aprovado", papel_do_chamador: "vinculado", permissoes: null };

const mockBaixarPdf = jest.fn();
jest.mock("../lib/baixarPdf", () => ({
  baixarPdf: (...args: unknown[]) => mockBaixarPdf(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
  mockBuscarPermissoes.mockReset();
  mockBuscarPermissoes.mockResolvedValue([FAMILIAR_APROVADO]);
  mockBaixarPdf.mockReset();
  mockBaixarPdf.mockResolvedValue(undefined);
  // O esqueleto registra a mensagem do erro em console.error; é esperado no caso de erro.
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("jest-axe: controle positivo", () => {
  it("detecta violação real (input sem label), então o teste não está vazio", async () => {
    const { container } = render(<input type="text" />);
    const resultado = await axe(container, AXE);
    expect(resultado.violations.map((v) => v.id)).toContain("label");
    expect(resultado).not.toHaveNoViolations();
  });
});

describe("Remedios: acessibilidade", () => {
  it("estado inicial das duas seções", async () => {
    const { container } = render(<Remedios />);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  describe.each(["idoso", "familiar"] as const)("seção %s", (sufixo) => {
    async function enviar(resposta: Response) {
      (global.fetch as jest.Mock).mockResolvedValue(resposta);
      const user = userEvent.setup();
      const utils = render(<Remedios />);
      if (sufixo === "familiar") await user.type(screen.getByLabelText("Id do idoso (familiar)", { exact: true }), "1");
      await user.type(screen.getByLabelText(`Nome (${sufixo})`, { exact: true }), "Remedio Ficticio");
      await user.type(screen.getByLabelText(`Dosagem (${sufixo})`, { exact: true }), "10 mg");
      await user.type(screen.getByLabelText(`Frequência (${sufixo})`, { exact: true }), "2x ao dia");
      fireEvent.change(screen.getByLabelText(`Data de início (${sufixo})`, { exact: true }), { target: { value: "2026-10-01" } });
      await user.click(screen.getByRole("button", { name: new RegExp(`^cadastrar medicamento \\(${sufixo}\\)$`, "i") }));
      return utils;
    }

    it("com sucesso em role=status visível", async () => {
      const { container } = await enviar(respostaJson(201, { id: 41 }));
      expect(await screen.findByRole("status")).toHaveTextContent("Medicamento cadastrado (id 41).");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it("com erro em role=alert visível", async () => {
      const { container } = await enviar(respostaJson(400, { error: "Mensagem de erro de teste." }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });
  });
});

// Item 5.2: seções "Marcar dose" em todos os estados. Mesmo limite: contraste de cor não é verificado em jsdom.
describe("Remedios: acessibilidade das seções de dose (item 5.2)", () => {
  it("estado inicial com as quatro seções (familiar aprovado)", async () => {
    const { container } = render(<Remedios />);
    await screen.findByRole("heading", { name: "Marcar dose de um idoso vinculado" });
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("estado inicial só com a seção de dose do idoso (sem vínculo)", async () => {
    mockBuscarPermissoes.mockResolvedValue([]);
    const { container } = render(<Remedios />);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: "Marcar dose de um idoso vinculado" })).not.toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("cuidador aprovado sem a flag: aviso em role=status", async () => {
    mockBuscarPermissoes.mockResolvedValue([
      {
        tipo_vinculo: "cuidador",
        status: "aprovado",
        papel_do_chamador: "vinculado",
        permissoes: { permite_registrar_saude: true, permite_marcar_dose: false, permite_criar_evento_cuidado: true },
      },
    ]);
    const { container } = render(<Remedios />);
    expect(await screen.findByRole("status")).toHaveTextContent(/não tem permissão para marcar dose/i);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  describe.each(["idoso", "vinculado"] as const)("seção %s", (sufixo) => {
    async function enviar(resposta: Response) {
      (global.fetch as jest.Mock).mockResolvedValue(resposta);
      const user = userEvent.setup();
      const utils = render(<Remedios />);
      await screen.findByRole("heading", { name: "Marcar dose de um idoso vinculado" });
      if (sufixo === "vinculado") await user.type(screen.getByLabelText("Id do idoso (dose, vinculado)", { exact: true }), "1");
      await user.type(screen.getByLabelText(`Id do medicamento (dose, ${sufixo})`, { exact: true }), "2");
      await user.selectOptions(screen.getByLabelText(`Situação da dose (${sufixo})`, { exact: true }), "atrasado");
      fireEvent.change(screen.getByLabelText(`Data e hora (opcional, ${sufixo})`, { exact: true }), { target: { value: "2026-10-02T08:30" } });
      await user.type(screen.getByLabelText(`Observações da dose (opcional, ${sufixo})`, { exact: true }), "obs falsa");
      await user.click(screen.getByRole("button", { name: new RegExp(`^marcar dose \\(${sufixo}\\)$`, "i") }));
      return utils;
    }

    it("com sucesso em role=status visível", async () => {
      const { container } = await enviar(respostaJson(201, { id: 61 }));
      expect(await screen.findByRole("status")).toHaveTextContent("Dose registrada (id 61).");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it.each([403, 400, 404, 409])("com erro %i em role=alert visível", async (status) => {
      const { container } = await enviar(respostaJson(status, { error: "Mensagem de erro de teste." }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it("durante o envio (botão ocupado)", async () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
      const user = userEvent.setup();
      const { container } = render(<Remedios />);
      await screen.findByRole("heading", { name: "Marcar dose de um idoso vinculado" });
      if (sufixo === "vinculado") await user.type(screen.getByLabelText("Id do idoso (dose, vinculado)", { exact: true }), "1");
      await user.type(screen.getByLabelText(`Id do medicamento (dose, ${sufixo})`, { exact: true }), "2");
      await user.click(screen.getByRole("button", { name: new RegExp(`^marcar dose \\(${sufixo}\\)$`, "i") }));
      expect(await screen.findByRole("button", { name: /marcando/i })).toBeDisabled();
      expect(await axe(container, AXE)).toHaveNoViolations();
    });
  });
});


// Item 5.3: seção "Ver histórico de remédios" em todos os estados. Mesmo limite: contraste de cor não é
// verificado em jsdom (item 9.1). Dados abaixo são valores obviamente falsos de teste.
describe("Remedios: acessibilidade da seção de histórico (item 5.3)", () => {
  const HISTORICO = {
    medicamentos: [
      {
        id: 1, idoso_id: 5, criado_por_id: 5, nome: "Remedio Historico Um", dosagem: "10 mg", frequencia: "2x ao dia",
        data_inicio: "2026-03-01", data_fim: null, observacoes: "obs falsa", ativo: true, editado_por_id: null,
        doses: [
          { id: 2, medicamento_id: 1, registrado_por_id: 5, data_hora_administracao: "2026-09-14T12:30:00.000Z", status_administracao: "administrado", observacoes: "obs dose falsa" },
          { id: 1, medicamento_id: 1, registrado_por_id: 5, data_hora_administracao: "2026-09-12T11:00:00.000Z", status_administracao: "pulado", observacoes: null },
        ],
      },
      {
        id: 2, idoso_id: 5, criado_por_id: 5, nome: "Remedio Historico Dois", dosagem: "5 ml", frequencia: "1x ao dia",
        data_inicio: "2026-01-31", data_fim: "2026-12-31", observacoes: null, ativo: false, editado_por_id: null, doses: [],
      },
    ],
  };

  async function buscar(resposta: Response | Promise<Response>) {
    (global.fetch as jest.Mock).mockReturnValue(resposta);
    const user = userEvent.setup();
    const utils = render(<Remedios />);
    await user.click(screen.getByRole("button", { name: /^ver histórico$/i }));
    return utils;
  }

  it("antes da busca", async () => {
    const { container } = render(<Remedios />);
    expect(screen.getByRole("heading", { name: "Ver histórico de remédios" })).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("carregando (botão ocupado)", async () => {
    const { container } = await buscar(new Promise(() => undefined));
    expect(await screen.findByRole("button", { name: /carregando/i })).toBeDisabled();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("com resultados, incluindo doses", async () => {
    const { container } = await buscar(Promise.resolve(respostaJson(200, HISTORICO)));
    expect(await screen.findByRole("status")).toHaveTextContent("2 medicamento(s) encontrado(s).");
    expect(screen.getByText(/14\/09\/2026 09:30, Administrado/)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("vazio", async () => {
    const { container } = await buscar(Promise.resolve(respostaJson(200, { medicamentos: [] })));
    expect(await screen.findByRole("status")).toHaveTextContent("Nenhum medicamento cadastrado.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("erro em role=alert", async () => {
    const { container } = await buscar(Promise.resolve(respostaJson(403, { error: "Mensagem de erro de teste." })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

// Item 5.4: seção "Exportar histórico em PDF" em todos os estados. Mesmo limite: contraste de cor não é
// verificado em jsdom (item 9.1).
describe("Remedios: acessibilidade da seção de exportar PDF (item 5.4)", () => {
  it("controle positivo: axe pega botão sem nome acessível, mesmo com aria-busy", async () => {
    const { container } = render(<button aria-busy="true" />);
    const resultado = await axe(container, AXE);
    expect(resultado.violations.map((v) => v.id)).toContain("button-name");
  });

  async function exportar(retorno: Promise<void>) {
    mockBaixarPdf.mockReturnValue(retorno);
    const user = userEvent.setup();
    const utils = render(<Remedios />);
    await user.click(screen.getByRole("button", { name: /^baixar histórico em pdf$/i }));
    return utils;
  }

  it("estado inicial", async () => {
    const { container } = render(<Remedios />);
    expect(screen.getByRole("heading", { name: "Exportar histórico em PDF" })).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("carregando (botão ocupado)", async () => {
    const { container } = await exportar(new Promise(() => undefined));
    expect(await screen.findByRole("button", { name: /gerando pdf/i })).toBeDisabled();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("sucesso em role=status", async () => {
    const { container } = await exportar(Promise.resolve());
    expect(await screen.findByRole("status")).toHaveTextContent("PDF gerado. O download começou.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("erro em role=alert", async () => {
    const { container } = await exportar(Promise.reject(new Error("Mensagem de erro de teste.")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
