import {
  avaliarConexaoCifrada,
  avaliarRedirecionamentoHttp,
  avaliarTde,
  avaliarTls,
  avaliarUrlBanco,
} from "./segurancaTransporte";

// Item 9.2 (RNF-002): avaliadores puros, sem I/O. Todos os valores abaixo são FICTÍCIOS.

describe("avaliarRedirecionamentoHttp", () => {
  const host = "api.exemplo.com";

  it.each([301, 302, 307, 308])("redirect %i para https:// do mesmo host: PASS", (status) => {
    expect(avaliarRedirecionamentoHttp({ status, location: `https://${host}/health` }, host).ok).toBe(true);
  });

  it("aceita Location com porta explícita no mesmo host", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: `https://${host}:443/x` }, host).ok).toBe(true);
  });

  it.each([200, 204, 400, 401, 404, 500, 503])("status %i sem redirect: FAIL", (status) => {
    expect(avaliarRedirecionamentoHttp({ status, location: null }, host).ok).toBe(false);
  });

  it("status 200 mesmo com Location https do mesmo host: FAIL (só 3xx de redirect vale)", () => {
    expect(avaliarRedirecionamentoHttp({ status: 200, location: `https://${host}/` }, host).ok).toBe(false);
  });

  it("redirect para http://: FAIL", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: `http://${host}/health` }, host).ok).toBe(false);
  });

  it("redirect para outro host: FAIL", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: "https://outro.exemplo.com/health" }, host).ok).toBe(false);
  });

  it("host parecido (sufixo ou prefixo) não conta como o mesmo host", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: `https://${host}.mal.com/` }, host).ok).toBe(false);
    expect(avaliarRedirecionamentoHttp({ status: 301, location: `https://x${host}/` }, host).ok).toBe(false);
  });

  it("redirect sem Location ou com Location ilegível: FAIL", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: null }, host).ok).toBe(false);
    expect(avaliarRedirecionamentoHttp({ status: 301, location: "" }, host).ok).toBe(false);
    expect(avaliarRedirecionamentoHttp({ status: 301, location: "/health" }, host).ok).toBe(false);
  });

  it("host é comparado sem diferenciar caixa", () => {
    expect(avaliarRedirecionamentoHttp({ status: 301, location: "https://API.Exemplo.com/" }, host).ok).toBe(true);
  });

  it.each(["ECONNREFUSED", "ECONNRESET"])("erro de rede %s (porta 80 fechada): PASS como recusado", (erro) => {
    const r = avaliarRedirecionamentoHttp({ erro }, host);
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("recusado");
  });

  it.each(["TIMEOUT", "ENOTFOUND", "EAI_AGAIN", "OUTRO"])("erro %s não prova recusa: FAIL", (erro) => {
    expect(avaliarRedirecionamentoHttp({ erro }, host).ok).toBe(false);
  });
});

describe("avaliarTls", () => {
  const bom = { protocolo: "TLSv1.3", autorizado: true, venceEmDias: 60 };

  it.each(["TLSv1.2", "TLSv1.3"])("%s, certificado autorizado e 14 dias ou mais: PASS", (protocolo) => {
    expect(avaliarTls({ ...bom, protocolo }).ok).toBe(true);
  });

  it("exatamente 14 dias: PASS; 13 dias: FAIL", () => {
    expect(avaliarTls({ ...bom, venceEmDias: 14 }).ok).toBe(true);
    expect(avaliarTls({ ...bom, venceEmDias: 13 }).ok).toBe(false);
  });

  it.each(["TLSv1.1", "TLSv1", "SSLv3", "", "TLSv1.4"])("protocolo %p: FAIL", (protocolo) => {
    expect(avaliarTls({ ...bom, protocolo }).ok).toBe(false);
  });

  it("certificado não autorizado: FAIL", () => {
    expect(avaliarTls({ ...bom, autorizado: false }).ok).toBe(false);
  });

  it("certificado vencido: FAIL", () => {
    expect(avaliarTls({ ...bom, venceEmDias: -1 }).ok).toBe(false);
  });
});

describe("avaliarUrlBanco", () => {
  const AZURE = "sqlserver://srv-fake.database.windows.net:1433;database=elder_web;user=u;password=p";

  it("Azure com encrypt=true e trustServerCertificate=false: ok", () => {
    const r = avaliarUrlBanco(`${AZURE};encrypt=true;trustServerCertificate=false`);
    expect(r).toEqual({
      host: "srv-fake.database.windows.net",
      encrypt: true,
      trustServerCertificate: false,
      ok: true,
      motivos: [],
    });
  });

  it("sem encrypt e sem trustServerCertificate: usa os padrões do Prisma (true e false) e é ok", () => {
    const r = avaliarUrlBanco(AZURE);
    expect(r.encrypt).toBe(true);
    expect(r.trustServerCertificate).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("encrypt=false em host não local: FAIL", () => {
    const r = avaliarUrlBanco(`${AZURE};encrypt=false`);
    expect(r.encrypt).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.motivos.length).toBeGreaterThan(0);
  });

  it("trustServerCertificate=true em host não local: FAIL", () => {
    const r = avaliarUrlBanco(`${AZURE};encrypt=true;trustServerCertificate=true`);
    expect(r.trustServerCertificate).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("encrypt com valor inválido em host não local: FAIL (não presume seguro)", () => {
    expect(avaliarUrlBanco(`${AZURE};encrypt=talvez`).ok).toBe(false);
  });

  it("chaves e valores booleanos sem diferenciar caixa", () => {
    const r = avaliarUrlBanco("sqlserver://srv-fake.database.windows.net:1433;ENCRYPT=FALSE;TrustServerCertificate=TRUE");
    expect(r.encrypt).toBe(false);
    expect(r.trustServerCertificate).toBe(true);
    expect(r.ok).toBe(false);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("host local %s com certificado autoassinado: sempre ok", (h) => {
    const r = avaliarUrlBanco(`sqlserver://${h}:14330;database=elder_web;encrypt=false;trustServerCertificate=true`);
    expect(r.ok).toBe(true);
    expect(r.trustServerCertificate).toBe(true);
  });

  it("host local sem porta", () => {
    expect(avaliarUrlBanco("sqlserver://localhost;trustServerCertificate=true").host).toBe("localhost");
  });

  it("host não local que não termina em .database.windows.net: ok com aviso", () => {
    const r = avaliarUrlBanco("sqlserver://db.exemplo.com:1433;encrypt=true;trustServerCertificate=false");
    expect(r.ok).toBe(true);
    expect(r.motivos.join(" ")).toContain("database.windows.net");
  });

  it("host que só contém .database.windows.net no meio não passa sem aviso", () => {
    const r = avaliarUrlBanco("sqlserver://x.database.windows.net.mal.com:1433;encrypt=true");
    expect(r.motivos.length).toBeGreaterThan(0);
  });

  it("formato inválido: não ok, sem host", () => {
    for (const url of ["", "postgres://x:5432/db", "lixo"]) {
      const r = avaliarUrlBanco(url);
      expect(r.ok).toBe(false);
      expect(r.host).toBe("");
    }
  });

  describe("nunca devolve usuário nem senha", () => {
    const SENTINELA = "Sen;tin}ela{=9x";
    const USUARIO = "usuario-sentinela";

    it("senha entre chaves com ; { } = e }} escapado", () => {
      const url = `sqlserver://srv-fake.database.windows.net:1433;database=elder_web;user=${USUARIO};password={Sen;tin}}ela{=9x};encrypt=true;trustServerCertificate=false`;
      const r = avaliarUrlBanco(url);
      const json = JSON.stringify(r);
      expect(json).not.toContain(SENTINELA);
      expect(json).not.toContain("Sen;tin");
      expect(json).not.toContain("tin}");
      expect(json).not.toContain("ela{");
      expect(json).not.toContain(USUARIO);
      expect(r.ok).toBe(true);
    });

    it("senha entre chaves contendo ';encrypt=false' não engana o parser", () => {
      const url = `sqlserver://srv-fake.database.windows.net:1433;user=u;password={a;encrypt=false;b};encrypt=true`;
      const r = avaliarUrlBanco(url);
      expect(r.encrypt).toBe(true);
      expect(r.ok).toBe(true);
      expect(JSON.stringify(r)).not.toContain("a;encrypt");
    });

    it("chaves do resultado são só as cinco permitidas, também em FAIL", () => {
      const url = `sqlserver://srv-fake.database.windows.net:1433;user=${USUARIO};password=${SENTINELA};encrypt=false`;
      const r = avaliarUrlBanco(url);
      expect(Object.keys(r).sort()).toEqual(["encrypt", "host", "motivos", "ok", "trustServerCertificate"]);
      expect(JSON.stringify(r)).not.toContain(SENTINELA);
      expect(JSON.stringify(r)).not.toContain(USUARIO);
    });

    it("formato inválido não ecoa a entrada", () => {
      expect(JSON.stringify(avaliarUrlBanco(`mysql://${USUARIO}:${SENTINELA}@x/db`))).not.toContain(SENTINELA);
    });
  });
});

describe("avaliarConexaoCifrada", () => {
  it("TRUE: PASS", () => {
    expect(avaliarConexaoCifrada("TRUE").ok).toBe(true);
  });

  it.each(["FALSE", "true", "", null, undefined, "1"])("%p: FAIL (a DMV devolve TRUE em maiúsculas)", (v) => {
    expect(avaliarConexaoCifrada(v as string | null | undefined).ok).toBe(false);
  });
});

describe("avaliarTde", () => {
  const bom = { engineEdition: 5, isEncrypted: 1, encryptionState: 3, encryptorType: "CERTIFICATE" };

  it("Azure SQL Database, criptografado, estado 3, chave do serviço: PASS", () => {
    const r = avaliarTde(bom);
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("gerenciada pelo serviço");
  });

  it("CERTIFICATE_OAEP_256 (valor visto no Azure real): mesma família do certificado, chave do serviço", () => {
    const r = avaliarTde({ ...bom, encryptorType: "CERTIFICATE_OAEP_256" });
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("gerenciada pelo serviço");
  });

  it("ASYMMETRIC KEY: PASS, informando chave do cliente", () => {
    const r = avaliarTde({ ...bom, encryptorType: "ASYMMETRIC KEY" });
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("chave do cliente");
  });

  it.each([8, 4, 2, 0, null])("EngineEdition %p diferente de 5: FAIL (premissa D1)", (engineEdition) => {
    const r = avaliarTde({ ...bom, engineEdition });
    expect(r.ok).toBe(false);
    expect(r.detalhe).toContain("EngineEdition");
  });

  it.each([0, null])("is_encrypted %p: FAIL", (isEncrypted) => {
    expect(avaliarTde({ ...bom, isEncrypted }).ok).toBe(false);
  });

  it("encryption_state 2 (criptografia em andamento): FAIL", () => {
    expect(avaliarTde({ ...bom, encryptionState: 2 }).ok).toBe(false);
  });

  it.each([0, 1, 4, 5, 6])("encryption_state %i diferente de 3: FAIL", (encryptionState) => {
    expect(avaliarTde({ ...bom, encryptionState }).ok).toBe(false);
  });

  it("DMV indisponível (campos nulos) com is_encrypted 1: PASS com aviso", () => {
    const r = avaliarTde({ engineEdition: 5, isEncrypted: 1, encryptionState: null, encryptorType: null });
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain("detalhe da chave indisponível");
  });

  it("DMV indisponível mas is_encrypted 0: FAIL", () => {
    expect(avaliarTde({ engineEdition: 5, isEncrypted: 0, encryptionState: null, encryptorType: null }).ok).toBe(false);
  });

  it("falha dupla (edição e criptografia) cita as duas", () => {
    const r = avaliarTde({ engineEdition: 2, isEncrypted: 0, encryptionState: null, encryptorType: null });
    expect(r.ok).toBe(false);
    expect(r.detalhe).toContain("EngineEdition");
    expect(r.detalhe).toContain("is_encrypted");
  });
});
