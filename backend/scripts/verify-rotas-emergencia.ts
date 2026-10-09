// Verificação ponta a ponta do aviso de emergência (RF novo, número a definir pelo grupo): rota REAL (app de ./app
// via Supertest), Prisma REAL e SQL Server LOCAL. Os testes de Jest mockam o Prisma; este script prova o filtro
// "só vínculo aprovado do próprio idoso" no SQL Server de verdade.
//
// Trocados só nas bordas externas: auth.verifyIdToken devolve { uid: <token> } (o "token" é o firebase_uid da conta
// de teste), auth.getUsers devolve todos verificados menos o uid marcado "naoverif", e globalThis.fetch vira um fake que registra o destinatário e responde 201. Nenhum e-mail sai, nenhuma
// chamada ao Firebase, nenhuma chave real (EMAIL_API_KEY recebe um valor fake só neste processo).
//
// Limpeza: as rotas usam o prisma global, sem transação revertida. Contas e vínculos criados são apagados no finally
// (prefixo verify-emerg- no firebase_uid marca sobra se o processo morrer no meio). A rota não escreve no banco:
// o COUNT(*) de Vinculo e Usuario é conferido antes e depois.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;..." npx tsx scripts/verify-rotas-emergencia.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomUUID } from "node:crypto";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const ok = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

async function main() {
  exigirBancoLocal();
  process.env.EMAIL_API_KEY = "chave-fake-do-verify";
  process.env.EMAIL_REMETENTE_ENDERECO = "avisos@teste.local";
  const { default: request } = await import("supertest");
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({ uid: t });
  (auth as unknown as { getUsers: (ids: { uid: string }[]) => Promise<unknown> }).getUsers = async (ids) => ({
    users: ids.map(({ uid }) => ({ uid, email: `${uid}@teste.local`, emailVerified: !uid.includes("naoverif") })),
    notFound: [],
  });
  const enviados: string[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    enviados.push(...(JSON.parse(String(init?.body)).to as { email: string }[]).map((d) => d.email));
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const tag = randomUUID().slice(0, 8);
  const usuarios: number[] = [];
  const contar = async () => [await prisma.usuario.count(), await prisma.vinculo.count()].join("/");

  async function conta(perfil: "idoso" | "cuidador" | "familiar", marca = "") {
    const uid = `verify-emerg-${tag}-${perfil}${marca}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil },
      select: { id: true, email: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid, email: u.email as string };
  }
  async function vincular(idosoId: number, vinculadoId: number, tipo: "cuidador" | "familiar", status: string) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status,
        data_solicitacao: new Date(),
      },
    });
  }
  const avisar = (token: string) => request(app).post("/emergencia/avisar").set("Authorization", `Bearer ${token}`);

  try {
    const idoso = await conta("idoso");
    const outroIdoso = await conta("idoso");
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    const pendente = await conta("cuidador");
    const recusado = await conta("familiar");
    const deOutro = await conta("familiar");
    const naoVerificado = await conta("familiar", "naoverif");
    await vincular(idoso.id, cuidador.id, "cuidador", "aprovado");
    await vincular(idoso.id, familiar.id, "familiar", "aprovado");
    await vincular(idoso.id, pendente.id, "cuidador", "pendente");
    await vincular(idoso.id, recusado.id, "familiar", "recusado");
    await vincular(outroIdoso.id, deOutro.id, "familiar", "aprovado");
    await vincular(idoso.id, naoVerificado.id, "familiar", "aprovado");
    const antes = await contar();

    const rCuidador = await avisar(cuidador.token);
    const rFamiliar = await avisar(familiar.token);
    ok("cuidador e familiar = 403, nada enviado", rCuidador.status === 403 && rFamiliar.status === 403 && enviados.length === 0, `${rCuidador.status}/${rFamiliar.status}`);

    const r = await avisar(idoso.token);
    ok("idoso = 200, avisados 2, falharam 0, nao_confirmados 1", r.status === 200 && r.body.avisados === 2 && r.body.falharam === 0 && r.body.nao_confirmados === 1, `status ${r.status}`);
    const esperados = [cuidador.email, familiar.email].sort();
    ok("só os 2 vínculos aprovados do próprio idoso receberam", JSON.stringify([...enviados].sort()) === JSON.stringify(esperados), `${enviados.length} envio(s)`);
    ok("resposta sem e-mail", !JSON.stringify(r.body).includes("@"), "");

    const r2 = await avisar(idoso.token);
    ok("segundo pedido logo depois = 429 com Retry-After", r2.status === 429 && Number(r2.headers["retry-after"]) > 0, `status ${r2.status}`);

    const rSemVinculo = await avisar(outroIdoso.token);
    ok("outro idoso (limite separado) avisa só o seu vínculo", rSemVinculo.status === 200 && enviados.at(-1) === deOutro.email, `status ${rSemVinculo.status}`);

    ok("rota não escreve no banco (COUNT Usuario/Vinculo igual)", (await contar()) === antes, antes);
  } finally {
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: `verify-emerg-${tag}` } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
  }

  console.log("\nCenário".padEnd(66) + "Resultado");
  console.log("-".repeat(90));
  for (const x of results) console.log(x.name.padEnd(66) + (x.pass ? "PASS" : "FAIL") + "  " + x.detail);
  const falhas = results.filter((x) => !x.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
