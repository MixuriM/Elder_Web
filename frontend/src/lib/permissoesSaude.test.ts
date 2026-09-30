import { buscarPermissoesSaude, decidirVisibilidade, type VinculoMinimo } from "./permissoesSaude";

const mockGetCurrentUserToken = jest.fn();
jest.mock("./auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

const flags = (registrar: boolean, dose = false, evento = false) => ({
  permite_registrar_saude: registrar,
  permite_marcar_dose: dose,
  permite_criar_evento_cuidado: evento,
});

function vinculo(parcial: Partial<VinculoMinimo>): VinculoMinimo {
  return { tipo_vinculo: "cuidador", status: "aprovado", papel_do_chamador: "vinculado", permissoes: null, ...parcial };
}

describe("decidirVisibilidade (regra só de UX; a autoridade é o 403 do backend)", () => {
  it("sem vínculo nenhum: oculta e não mostra aviso", () => {
    expect(decidirVisibilidade([])).toEqual({ escrita: false, avisoSemFlag: false });
  });

  it("cuidador vinculado com permite_registrar_saude: escrita liberada, sem aviso", () => {
    expect(decidirVisibilidade([vinculo({ permissoes: flags(true) })])).toEqual({ escrita: true, avisoSemFlag: false });
  });

  it("cuidador vinculado sem a flag: oculta e mostra aviso", () => {
    expect(decidirVisibilidade([vinculo({ permissoes: flags(false) })])).toEqual({ escrita: false, avisoSemFlag: true });
  });

  it("só permite_marcar_dose (ou só evento) NÃO habilita escrita de saúde", () => {
    expect(decidirVisibilidade([vinculo({ permissoes: flags(false, true, true) })]).escrita).toBe(false);
  });

  it("permissoes null em cuidador vinculado não habilita", () => {
    expect(decidirVisibilidade([vinculo({ permissoes: null })])).toEqual({ escrita: false, avisoSemFlag: true });
  });

  it("familiar aprovado vinculado: escrita liberada", () => {
    expect(decidirVisibilidade([vinculo({ tipo_vinculo: "familiar" })])).toEqual({ escrita: true, avisoSemFlag: false });
  });

  it("papéis dono e titular não contam, nem para liberar nem para o aviso", () => {
    const itens = [
      vinculo({ tipo_vinculo: "cuidador", papel_do_chamador: "dono", permissoes: flags(true) }),
      vinculo({ tipo_vinculo: "familiar", papel_do_chamador: "titular" }),
      vinculo({ tipo_vinculo: "cuidador", papel_do_chamador: "titular", permissoes: flags(true) }),
    ];
    expect(decidirVisibilidade(itens)).toEqual({ escrita: false, avisoSemFlag: false });
  });

  it("vínculo não aprovado não conta (defesa além do filtro da busca)", () => {
    expect(decidirVisibilidade([vinculo({ tipo_vinculo: "familiar", status: "pendente" })]).escrita).toBe(false);
  });

  it("qualquer um qualifica: um cuidador sem flag e outro com flag liberam", () => {
    const itens = [vinculo({ permissoes: flags(false) }), vinculo({ permissoes: flags(true) })];
    expect(decidirVisibilidade(itens)).toEqual({ escrita: true, avisoSemFlag: false });
  });
});

describe("buscarPermissoesSaude", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  it("chama GET /vinculo?status=aprovado com token e devolve a lista", async () => {
    const lista = [vinculo({ permissoes: flags(true) })];
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ vinculos: lista }) });

    await expect(buscarPermissoesSaude()).resolves.toEqual(lista);

    const [url, opcoes] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/vinculo\?status=aprovado$/);
    expect(opcoes.method).toBe("GET");
    expect(opcoes.headers.Authorization).toBe("Bearer token-fake");
  });

  it("propaga o erro do backend", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "Erro interno." }) });
    await expect(buscarPermissoesSaude()).rejects.toThrow("Erro interno.");
  });

  it("propaga falha de rede", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError("rede"));
    await expect(buscarPermissoesSaude()).rejects.toThrow("rede");
  });
});
