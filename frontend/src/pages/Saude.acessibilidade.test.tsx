import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Saude from "./Saude";
import * as permissoesSaude from "../lib/permissoesSaude";

expect.extend(toHaveNoViolations);

// Item 4.x: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /saude.
// LIMITE: jsdom não calcula layout nem cor, então contraste de cor NÃO é verificado aqui
// (regra color-contrast desligada de propósito, ver AXE). Contraste segue pendente para o item 9.1.
// Dados de saúde abaixo são valores obviamente falsos de teste.
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
jest.mock("../lib/permissoesSaude", () => ({
  ...jest.requireActual("../lib/permissoesSaude"),
  usePermissoesSaude: jest.fn(),
}));
const mockUsePermissoes = permissoesSaude.usePermissoesSaude as jest.Mock;
const { usePermissoesSaude: usePermissoesReal } = jest.requireActual("../lib/permissoesSaude");

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
  mockUsePermissoes.mockReturnValue({ estado: "ok", escrita: true, avisoSemFlag: false });
});

describe("jest-axe: controle positivo", () => {
  it("detecta violação real (input sem label), então o teste não está vazio", async () => {
    const { container } = render(<input type="text" />);
    const resultado = await axe(container, AXE);
    expect(resultado.violations.map((v) => v.id)).toContain("label");
    expect(resultado).not.toHaveNoViolations();
  });
});

describe("Saude: acessibilidade por estado de permissão", () => {
  const item = (extra: Record<string, unknown>) => ({
    tipo_vinculo: "cuidador",
    status: "aprovado",
    papel_do_chamador: "vinculado",
    permissoes: null,
    ...extra,
  });
  const flags = (registrar: boolean) => ({
    permite_registrar_saude: registrar,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
  });

  beforeEach(() => {
    mockUsePermissoes.mockImplementation(usePermissoesReal);
  });

  it("página inteira com cuidador habilitado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { vinculos: [item({ permissoes: flags(true) })] }));
    const { container } = render(<Saude />);
    await screen.findByRole("heading", { name: /Registrar leitura de saúde de um idoso/ });
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("cuidador sem a flag: aviso visível e seções ocultas", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { vinculos: [item({ permissoes: flags(false) })] }));
    const { container } = render(<Saude />);
    expect(await screen.findByText(/não tem a permissão de registrar saúde/)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("estado carregando", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const { container } = render(<Saude />);
    expect(await screen.findByText(/verificando permissões/i)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("erro ao verificar permissões: alerta visível e seções visíveis", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(500, { error: "Erro interno." }));
    const { container } = render(<Saude />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível verificar suas permissões/);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("sem vínculo: só as seções do idoso e o histórico", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { vinculos: [] }));
    const { container } = render(<Saude />);
    await waitFor(() => expect(screen.queryByText(/verificando permissões/i)).not.toBeInTheDocument());
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

type Secao = {
  nome: string;
  preencher: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
  botao: RegExp;
  corpoSucesso: unknown;
  textoSucesso: RegExp;
};

const digitar = (rotulo: string, texto: string) => async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(rotulo, { exact: true }), texto);
};
const em = (...passos: ((user: ReturnType<typeof userEvent.setup>) => Promise<void>)[]) =>
  async (user: ReturnType<typeof userEvent.setup>) => {
    for (const passo of passos) await passo(user);
  };

const SECOES: Secao[] = [
  {
    nome: "registro do idoso",
    preencher: em(digitar("Tipo de medição", "tipo-falso"), digitar("Valor 1", "1"), digitar("Unidade", "un-falsa")),
    botao: /^registrar leitura$/i,
    corpoSucesso: { id: 11 },
    textoSucesso: /Leitura registrada \(id 11\)/,
  },
  {
    nome: "registro do cuidador ou familiar",
    preencher: em(
      digitar("Id do idoso", "1"),
      digitar("Tipo de medição (cuidador)", "tipo-falso"),
      digitar("Valor 1 (cuidador)", "1"),
      digitar("Unidade (cuidador)", "un-falsa"),
    ),
    botao: /registrar leitura do idoso/i,
    corpoSucesso: { id: 12 },
    textoSucesso: /Leitura do idoso registrada \(id 12\)/,
  },
  {
    nome: "edição própria do idoso",
    preencher: digitar("Id do registro (edição)", "1"),
    botao: /^salvar edição \(edição\)$/i,
    corpoSucesso: { id: 13 },
    textoSucesso: /Registro atualizado \(id 13\)/,
  },
  {
    nome: "edição de idoso vinculado",
    preencher: em(digitar("Id do idoso (edição, idoso vinculado)", "1"), digitar("Id do registro (edição, idoso vinculado)", "1")),
    botao: /salvar edição \(edição, idoso vinculado\)/i,
    corpoSucesso: { id: 14 },
    textoSucesso: /Registro atualizado \(id 14\)/,
  },
  {
    nome: "histórico",
    preencher: async () => undefined,
    botao: /^ver histórico$/i,
    corpoSucesso: {
      registros: [{ id: 15, tipo_medicao: "tipo-falso", valor_1: 1, valor_2: null, unidade: "un-falsa", data_hora: "2026-01-01T10:00:00.000Z" }],
    },
    textoSucesso: /#15 tipo-falso/,
  },
];

describe.each(SECOES)("Saude: acessibilidade da seção $nome", (secao) => {
  beforeEach(() => {
    // O esqueleto registra a mensagem do erro em console.error; é esperado no caso de erro.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("com erro em role=alert visível", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "Mensagem de erro de teste." }));
    const user = userEvent.setup();
    const { container } = render(<Saude />);
    await secao.preencher(user);
    await user.click(screen.getByRole("button", { name: secao.botao }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("com resultado de sucesso visível", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, secao.corpoSucesso));
    const user = userEvent.setup();
    const { container } = render(<Saude />);
    await secao.preencher(user);
    await user.click(screen.getByRole("button", { name: secao.botao }));
    expect(await screen.findByText(secao.textoSucesso)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
