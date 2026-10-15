import { contaPorSlug, ELENCO, ehUidDemo, UIDS_ELENCO } from "./elenco";

// Modo demonstração (D3): elenco fixo de contas FICTÍCIAS. Fonte única para rotas, semente e testes.
describe("elenco do modo demonstração", () => {
  it("tem as seis contas fixas, com o perfil de cada uma", () => {
    expect(ELENCO.map((c) => [c.slug, c.tipo_perfil])).toEqual([
      ["idosa-helena", "idoso"],
      ["idoso-antonio", "idoso"],
      ["cuidadora-marta", "cuidador"],
      ["cuidador-paulo", "cuidador"],
      ["familiar-carlos", "familiar"],
      ["familiar-renata", "familiar"],
    ]);
  });

  it("uid = demo- + slug, e-mail no domínio .test, slugs e uids únicos", () => {
    for (const c of ELENCO) {
      expect(c.slug).toMatch(/^[a-z]+-[a-z]+$/);
      expect(c.uid).toBe(`demo-${c.slug}`);
      expect(c.email).toBe(`${c.slug}@demo.elderweb.test`);
      expect(c.nome.length).toBeGreaterThan(0);
      expect(c.nome.length).toBeLessThanOrEqual(150);
      expect(c.descricao.length).toBeGreaterThan(0);
      expect(c.descricao.length).toBeLessThanOrEqual(120);
    }
    expect(new Set(ELENCO.map((c) => c.slug)).size).toBe(6);
    expect(new Set(UIDS_ELENCO).size).toBe(6);
  });

  it("contaPorSlug só aceita um slug exato da lista fechada", () => {
    expect(contaPorSlug("idosa-helena")?.uid).toBe("demo-idosa-helena");
    for (const lixo of [undefined, null, 1, [], ["idosa-helena"], {}, { slug: "idosa-helena" }, "", "__proto__", "constructor", "toString", "../x", "demo-idosa-helena", "IDOSA-HELENA", " idosa-helena"]) {
      expect(contaPorSlug(lixo)).toBeUndefined();
    }
  });

  it("ehUidDemo compara exato com a lista fechada, nunca por prefixo", () => {
    expect(ehUidDemo("demo-cuidador-paulo")).toBe(true);
    for (const lixo of ["demo-", "demo-qualquer", "demo-idosa-helena-2", "idosa-helena", "", undefined, null, 5]) {
      expect(ehUidDemo(lixo)).toBe(false);
    }
  });
});
