import http from "node:http";
import type { AddressInfo } from "node:net";
import { avaliarRedirecionamentoHttp } from "./segurancaTransporte";
import { sondarHttpPlano, sondarTls } from "./sondaHttp";

// Item 9.2 (RNF-002): sondarHttpPlano contra servidores http locais em porta efêmera. sondarTls só é
// exercitado no smoke real (sem certificado de teste no CI e sem dependência nova): limitação aceita;
// aqui só a recusa por NODE_TLS_REJECT_UNAUTHORIZED, que não precisa de rede.
const HOST = "127.0.0.1";
const CORPO = "corpo-sentinela-nunca-lido";

let servidores: http.Server[] = [];

function subir(handler: http.RequestListener): Promise<number> {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    servidores.push(s);
    s.listen(0, HOST, () => resolve((s.address() as AddressInfo).port));
  });
}

afterEach(async () => {
  await Promise.all(
    servidores.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
  servidores = [];
});

async function sondarEAvaliar(handler: http.RequestListener, timeoutMs = 5000) {
  const porta = await subir(handler);
  const sonda = await sondarHttpPlano(`http://${HOST}:${porta}/health`, { timeoutMs });
  return { sonda, avaliacao: avaliarRedirecionamentoHttp(sonda, HOST) };
}

describe("sondarHttpPlano", () => {
  it("301 para https:// do mesmo host: PASS", async () => {
    const { sonda, avaliacao } = await sondarEAvaliar((req, res) => {
      res.writeHead(301, { Location: `https://${HOST}${req.url}` }).end(CORPO);
    });
    expect(sonda).toEqual({ status: 301, location: `https://${HOST}/health` });
    expect(avaliacao.ok).toBe(true);
  });

  it("200: FAIL", async () => {
    const { avaliacao } = await sondarEAvaliar((_req, res) => res.writeHead(200).end(CORPO));
    expect(avaliacao.ok).toBe(false);
  });

  it("redirect para http://: FAIL", async () => {
    const { avaliacao } = await sondarEAvaliar((req, res) => {
      res.writeHead(301, { Location: `http://${HOST}${req.url}` }).end();
    });
    expect(avaliacao.ok).toBe(false);
  });

  it("redirect para outro host: FAIL", async () => {
    const { avaliacao } = await sondarEAvaliar((req, res) => {
      res.writeHead(301, { Location: `https://outro.exemplo.com${req.url}` }).end();
    });
    expect(avaliacao.ok).toBe(false);
  });

  it("não segue o redirect: devolve o 301, não o resultado do destino", async () => {
    const { sonda } = await sondarEAvaliar((req, res) => {
      res.writeHead(302, { Location: `http://${HOST}:1/x` }).end();
      void req;
    });
    expect("status" in sonda && sonda.status).toBe(302);
  });

  it("nunca devolve o corpo da resposta", async () => {
    const { sonda } = await sondarEAvaliar((_req, res) => res.writeHead(200).end(CORPO));
    expect(JSON.stringify(sonda)).not.toContain(CORPO);
    expect(Object.keys(sonda).sort()).toEqual(["location", "status"]);
  });

  it("porta fechada: PASS como recusado", async () => {
    const porta = await subir((_req, res) => res.end());
    await new Promise<void>((resolve) => servidores[0].close(() => resolve()));
    const sonda = await sondarHttpPlano(`http://${HOST}:${porta}/health`, { timeoutMs: 5000 });
    expect(sonda).toEqual({ erro: "ECONNREFUSED" });
    expect(avaliarRedirecionamentoHttp(sonda, HOST).ok).toBe(true);
  });

  it("servidor que nunca responde: timeout curto é FAIL, não recusado", async () => {
    const { sonda, avaliacao } = await sondarEAvaliar(() => undefined, 200);
    expect(sonda).toEqual({ erro: "TIMEOUT" });
    expect(avaliacao.ok).toBe(false);
  });

  it("DNS inexistente (.invalid) não prova recusa: FAIL", async () => {
    const sonda = await sondarHttpPlano("http://host-que-nao-existe.invalid/health", { timeoutMs: 5000 });
    expect("erro" in sonda).toBe(true);
    expect(avaliarRedirecionamentoHttp(sonda, "host-que-nao-existe.invalid").ok).toBe(false);
  });
});

describe("sondarTls", () => {
  // Sem certificado de teste no CI, a rejeição é exercitada com um servidor HTTP puro: o aperto de mão falha.
  // Prova o caminho "falha vira rejeição com mensagem fixa e só o código", sem eco do erro bruto. O caso
  // específico de certificado inválido ou vencido (CERT_HAS_EXPIRED etc.) só é coberto pelo smoke real.
  it("aperto de mão que falha rejeita com mensagem fixa: só o código, sem texto bruto do erro", async () => {
    const porta = await subir((_req, res) => res.end(CORPO));
    const erro = await sondarTls(HOST, porta).then(
      () => null,
      (e: Error) => e,
    );
    expect(erro).not.toBeNull();
    expect(erro!.message).toMatch(/^Falha na conexão TLS \([A-Z0-9_]+\)\.$/);
    expect(erro!.message).not.toContain(CORPO);
  });

  it("recusa rodar com NODE_TLS_REJECT_UNAUTHORIZED=0, sem abrir conexão", async () => {
    const original = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    try {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      await expect(sondarTls(HOST, 1)).rejects.toThrow("NODE_TLS_REJECT_UNAUTHORIZED");
    } finally {
      if (original === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = original;
    }
  });
});
