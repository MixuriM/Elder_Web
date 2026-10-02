import { decidirVisibilidadeDose, type VinculoMinimo } from "./permissoesSaude";

// auth.ts carrega o SDK do Firebase, que não roda em jsdom: só a função pura é exercitada aqui.
jest.mock("./auth", () => ({ getCurrentUserToken: jest.fn() }));

// Item 5.2: regra de visibilidade da seção "Marcar dose de um idoso vinculado". Dados fictícios.
const FLAGS = { permite_registrar_saude: false, permite_marcar_dose: false, permite_criar_evento_cuidado: false };

function v(over: Partial<VinculoMinimo> = {}): VinculoMinimo {
  return { tipo_vinculo: "cuidador", status: "aprovado", papel_do_chamador: "vinculado", permissoes: { ...FLAGS }, ...over };
}

describe("decidirVisibilidadeDose", () => {
  it("cuidador aprovado com permite_marcar_dose: escrita, sem aviso", () => {
    expect(decidirVisibilidadeDose([v({ permissoes: { ...FLAGS, permite_marcar_dose: true } })])).toEqual({ escrita: true, avisoSemFlag: false });
  });

  it("cuidador aprovado só com as outras duas flags: sem escrita, com aviso", () => {
    const permissoes = { permite_registrar_saude: true, permite_marcar_dose: false, permite_criar_evento_cuidado: true };
    expect(decidirVisibilidadeDose([v({ permissoes })])).toEqual({ escrita: false, avisoSemFlag: true });
  });

  it("cuidador com permissoes null não conta como escrita", () => {
    expect(decidirVisibilidadeDose([v({ permissoes: null })])).toEqual({ escrita: false, avisoSemFlag: true });
  });

  it("familiar aprovado: escrita, sem aviso", () => {
    expect(decidirVisibilidadeDose([v({ tipo_vinculo: "familiar", permissoes: null })])).toEqual({ escrita: true, avisoSemFlag: false });
  });

  it.each(["pendente", "recusado"])("vínculo %s não conta, nem para aviso", (status) => {
    const permissoes = { ...FLAGS, permite_marcar_dose: true };
    expect(decidirVisibilidadeDose([v({ status, permissoes }), v({ status, tipo_vinculo: "familiar" })])).toEqual({ escrita: false, avisoSemFlag: false });
  });

  it.each(["dono", "titular"] as const)("papel %s não conta, mesmo aprovado e com a flag", (papel) => {
    const permissoes = { ...FLAGS, permite_marcar_dose: true };
    expect(decidirVisibilidadeDose([v({ papel_do_chamador: papel, permissoes }), v({ papel_do_chamador: papel, tipo_vinculo: "familiar" })])).toEqual({
      escrita: false,
      avisoSemFlag: false,
    });
  });

  it("sem vínculos: nada", () => {
    expect(decidirVisibilidadeDose([])).toEqual({ escrita: false, avisoSemFlag: false });
  });

  it("vários vínculos: um que qualifica basta e some o aviso", () => {
    expect(decidirVisibilidadeDose([v(), v({ tipo_vinculo: "familiar", permissoes: null })])).toEqual({ escrita: true, avisoSemFlag: false });
  });
});
