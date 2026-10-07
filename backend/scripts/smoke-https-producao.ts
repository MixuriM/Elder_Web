// Teste de fumaça pós-deploy do item 9.2 (RNF-002): a API de produção só aceita HTTPS. SOMENTE LEITURA:
// quatro GET sem token e uma conexão TLS que não envia dado. Nunca imprime corpo de resposta, token nem
// dado de saúde: só nome do check, status, host e PASS/FAIL.
//
// Uso (dentro de backend/): npx tsx scripts/smoke-https-producao.ts https://<api>
// A URL vem por argumento, nunca embutida. Timeout de 90 s por requisição (cold start do Render free).

import { HSTS_VALOR } from "../src/middleware/hsts";
import { avaliarRedirecionamentoHttp, avaliarTls, type Avaliacao } from "../src/lib/segurancaTransporte";
import { sondarHttpPlano, sondarTls } from "../src/lib/sondaHttp";

const TIMEOUT_MS = 90_000;
const ROTAS = ["/health", "/usuario/me"];

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const registrar = (name: string, a: Avaliacao) => results.push({ name, pass: a.ok, detail: a.detalhe });

// Só status e valor do header HSTS; o corpo nunca é lido.
async function sondarHsts(url: string): Promise<Avaliacao> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    void res.body?.cancel().catch(() => undefined);
    const valor = res.headers.get("strict-transport-security");
    return valor === HSTS_VALOR
      ? { ok: true, detalhe: `status ${res.status}, HSTS ${valor}` }
      : { ok: false, detalhe: `status ${res.status}, HSTS ${valor ?? "ausente"} (esperado ${HSTS_VALOR})` };
  } catch {
    return { ok: false, detalhe: "falha de rede ou timeout" };
  }
}

async function checarHealth(url: string): Promise<Avaliacao> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const status = res.status;
    // Só o campo `status` do JSON é lido; o resto não é guardado nem impresso.
    const campo = status === 200 ? ((await res.json()) as { status?: unknown }).status : undefined;
    return status === 200 && campo === "ok"
      ? { ok: true, detalhe: "status 200, campo status=ok" }
      : { ok: false, detalhe: `status ${status}${status === 200 ? ", campo status diferente de ok" : ""}` };
  } catch {
    return { ok: false, detalhe: "falha de rede, timeout ou resposta que não é JSON" };
  }
}

async function main() {
  let host = "";
  try {
    const u = new URL(process.argv[2] ?? "");
    if (u.protocol !== "https:") throw new Error("não https");
    host = u.hostname;
  } catch {
    console.error("Uso: npx tsx scripts/smoke-https-producao.ts https://<api>");
    process.exitCode = 2;
    return;
  }
  console.log(`Alvo: ${host}\n`);

  for (const rota of ROTAS) {
    const sonda = await sondarHttpPlano(`http://${host}${rota}`, { timeoutMs: TIMEOUT_MS });
    registrar(`C1 http://${host}${rota} redireciona ou recusa`, avaliarRedirecionamentoHttp(sonda, host));
  }

  try {
    registrar("C2 TLS na porta 443", avaliarTls(await sondarTls(host, 443)));
  } catch (e) {
    registrar("C2 TLS na porta 443", { ok: false, detalhe: e instanceof Error ? e.message : "falha na sonda TLS" });
  }

  registrar("C3 GET /health responde 200 com status ok", await checarHealth(`https://${host}/health`));

  for (const rota of ROTAS) {
    registrar(`C4 HSTS em https://${host}${rota}`, await sondarHsts(`https://${host}${rota}`));
  }

  console.log("Check".padEnd(72) + "Resultado");
  console.log("-".repeat(100));
  for (const r of results) console.log(r.name.padEnd(72) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.some((r) => r.name.startsWith("C4"))) {
    console.log(
      "Dica C4: antes do deploy do item 9.2 a falha é esperada. Depois do deploy, indica NODE_ENV=production não aplicado no Render.",
    );
  }
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch(() => {
  console.error("Erro fatal no smoke (detalhe omitido de propósito).");
  process.exitCode = 1;
});
