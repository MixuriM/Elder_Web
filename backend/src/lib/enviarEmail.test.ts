import { configuracaoEmail, enviarEmail, ErroEnvioEmail } from "./enviarEmail";

// fetch sempre mockado: nenhum teste chega ao provedor de verdade. Chave, endereços e textos são FICTÍCIOS.
const CHAVE_FAKE = "chave-fake-de-teste";
const MSG = { para: "destino@exemplo.test", assunto: "Assunto de teste", texto: "Texto de teste" };
const ENV_ORIGINAL = { ...process.env };
let fetchMock: jest.SpyInstance;

beforeEach(() => {
  process.env.EMAIL_API_KEY = CHAVE_FAKE;
  process.env.EMAIL_REMETENTE_ENDERECO = "avisos@exemplo.test";
  process.env.EMAIL_REMETENTE_NOME = "Elder Web Teste";
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  fetchMock.mockRestore();
});

async function erroDe(p: Promise<unknown>): Promise<ErroEnvioEmail> {
  try {
    await p;
  } catch (e) {
    return e as ErroEnvioEmail;
  }
  throw new Error("era para falhar");
}

describe("configuracaoEmail", () => {
  it("sem chave ou sem endereço do remetente: null", () => {
    delete process.env.EMAIL_API_KEY;
    expect(configuracaoEmail()).toBeNull();
    process.env.EMAIL_API_KEY = CHAVE_FAKE;
    process.env.EMAIL_REMETENTE_ENDERECO = "  ";
    expect(configuracaoEmail()).toBeNull();
  });

  it("sem nome do remetente: usa Elder Web", () => {
    delete process.env.EMAIL_REMETENTE_NOME;
    expect(configuracaoEmail()?.nome).toBe("Elder Web");
  });
});

describe("enviarEmail", () => {
  it("faz um POST HTTPS com a chave no header e só um destinatário, em texto puro", async () => {
    await enviarEmail(MSG);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(CHAVE_FAKE);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "Elder Web Teste", email: "avisos@exemplo.test" },
      to: [{ email: MSG.para }],
      subject: MSG.assunto,
      textContent: MSG.texto,
    });
  });

  it("sem configuração: erro SEM_CONFIGURACAO e nenhuma chamada de rede", async () => {
    delete process.env.EMAIL_API_KEY;
    const erro = await erroDe(enviarEmail(MSG));
    expect(erro).toBeInstanceOf(ErroEnvioEmail);
    expect(erro.codigo).toBe("SEM_CONFIGURACAO");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta não 2xx: erro com o status, sem ler o corpo e sem a chave na mensagem", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: `eco ${MSG.para}` }), { status: 401 }));
    const erro = await erroDe(enviarEmail(MSG));
    expect(erro.codigo).toBe("HTTP_401");
    expect(erro.message).not.toContain(CHAVE_FAKE);
    expect(erro.message).not.toContain(MSG.para);
  });

  it("timeout: erro TIMEOUT, uma tentativa só (sem retry)", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    const erro = await erroDe(enviarEmail(MSG));
    expect(erro.codigo).toBe("TIMEOUT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede: erro REDE, sem repassar a mensagem original", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed ${CHAVE_FAKE}`));
    const erro = await erroDe(enviarEmail(MSG));
    expect(erro.codigo).toBe("REDE");
    expect(erro.message).not.toContain(CHAVE_FAKE);
  });
});
