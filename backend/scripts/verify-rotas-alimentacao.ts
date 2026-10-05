// Verificação ponta a ponta do item 7.1 (RF-018): rota REAL (app de ./app via Supertest), Prisma REAL e SQL Server
// LOCAL. Os testes de Jest mockam o Prisma; este script exercita o caminho inteiro junto, inclusive o nvarchar(500)
// de RegistroAlimentar.descricao com acentos e o datetime2 de data_hora.
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken passa a devolver { uid: <token> },
// então o "token" enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e
// nenhuma chamada de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida. Todo dado
// criado (contas, vínculos, registros) é rastreado e apagado no finally; o COUNT(*) de RegistroAlimentar, Usuario e
// Vinculo é conferido antes e depois. O prefixo `verify-alim-` no firebase_uid marca conta residual se o processo
// for morto no meio. A descrição leva uma sentinela única: o script confere 0 ocorrência dela em stdout e stderr
// (o próprio relatório não imprime valores de registro).
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=...;encrypt=true;trustServerCertificate=true" npx tsx scripts/verify-rotas-alimentacao.ts
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
  // Imports depois da trava: carregar ./app já cria o PrismaClient e o app do Firebase Admin.
  const { default: request } = await import("supertest");
  // app primeiro: ele carrega o dotenv, de que firebaseAdmin depende ao inicializar.
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({
    uid: t,
    email_verified: true,
  });

  const tag = randomUUID().slice(0, 8);
  const sentinela = `sentinela-alim-${randomUUID()}`;
  const usuarios: number[] = [];

  // Captura stdout/stderr do processo inteiro (inclui o errorHandler e o Prisma) para conferir a sentinela.
  const capturado: string[] = [];
  const outOriginal = process.stdout.write.bind(process.stdout);
  const errOriginal = process.stderr.write.bind(process.stderr);
  const espiar = (original: typeof process.stdout.write) =>
    ((chunk: unknown, ...resto: unknown[]) => {
      capturado.push(String(chunk));
      return (original as (...a: unknown[]) => boolean)(chunk, ...resto);
    }) as typeof process.stdout.write;
  process.stdout.write = espiar(outOriginal);
  process.stderr.write = espiar(errOriginal);

  async function conta(perfil: "idoso" | "cuidador" | "familiar", modo: "idoso" | "familiar" | null = null) {
    const uid = `verify-alim-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: modo },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid };
  }

  async function vincular(
    idosoId: number,
    vinculadoId: number,
    tipo: "cuidador" | "familiar",
    flags = false,
    status: "aprovado" | "pendente" = "aprovado",
  ) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status,
        aprovador_id: status === "pendente" ? null : idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: flags,
        permite_registrar_saude: flags,
        permite_criar_evento_cuidado: flags,
      },
    });
  }

  const registrosDe = (idosoId: number) =>
    prisma.registroAlimentar.findMany({ where: { idoso_id: idosoId }, orderBy: { id: "asc" } });
  const contarRegistros = () => prisma.registroAlimentar.count();
  const contarUsuarios = () => prisma.usuario.count();
  const contarVinculos = () => prisma.vinculo.count();
  const post = (token: string, caminho: string, corpo: object) =>
    request(app).post(caminho).set("Authorization", `Bearer ${token}`).send(corpo);
  const corpo = (over: object = {}) => ({
    refeicao: "almoco",
    descricao: `${sentinela}-descricao`,
    data_hora: "2026-10-10T09:00:00-03:00",
    ...over,
  });

  const registrosAntes = await contarRegistros();
  const usuariosAntes = await contarUsuarios();
  const vinculosAntes = await contarVinculos();
  try {
    const idoso = await conta("idoso");
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    const familiarPend = await conta("familiar");
    await vincular(idoso.id, cuidador.id, "cuidador", true);
    await vincular(idoso.id, familiar.id, "familiar");
    await vincular(idoso.id, familiarPend.id, "familiar", false, "pendente");
    const rota = `/alimentacao/idoso/${idoso.id}`;

    // 1: idoso cria; a linha existe com idoso_id, registrado_por_id, refeicao e editado_por_id corretos.
    const r1 = await post(idoso.token, "/alimentacao", corpo());
    const l1 = await registrosDe(idoso.id);
    ok(
      "idoso cria: 201, linha com idoso_id, registrado_por_id, refeicao, editado_por_id null",
      r1.status === 201 &&
        l1.length === 1 &&
        l1[0].idoso_id === idoso.id &&
        l1[0].registrado_por_id === idoso.id &&
        l1[0].refeicao === "almoco" &&
        l1[0].editado_por_id === null &&
        r1.body.id === l1[0].id,
      `status ${r1.status}, ${l1.length} linha(s)`,
    );

    // 2: data_hora com offset grava o instante UTC exato e volta igual.
    const lido = l1[0]?.data_hora.toISOString();
    ok(
      "09:00-03:00 gravado como 12:00Z e lido de volta",
      lido === "2026-10-10T12:00:00.000Z" && r1.body.data_hora === "2026-10-10T12:00:00.000Z",
      `lido ${lido}`,
    );

    // 3: descricao de 500 caracteres com acentos cabe em nvarchar(500) e volta idêntica.
    const acentuada = `${sentinela}-`.padEnd(500, "çãé");
    const r3 = await post(idoso.token, "/alimentacao", corpo({ refeicao: "ceia", descricao: acentuada }));
    const l3 = await prisma.registroAlimentar.findFirst({ where: { idoso_id: idoso.id, refeicao: "ceia" } });
    ok(
      "descricao de 500 caracteres com acentos cabe em nvarchar(500) e volta idêntica",
      r3.status === 201 && acentuada.length === 500 && l3?.descricao === acentuada,
      `status ${r3.status}, tamanho lido ${l3?.descricao.length}`,
    );

    // 4: familiar conforme modo_decisao do idoso.
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const n4 = await contarRegistros();
    const r4 = await post(familiar.token, rota, corpo());
    ok("familiar com modo_decisao 'idoso': 403 e nenhuma linha", r4.status === 403 && (await contarRegistros()) === n4, `status ${r4.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const r5 = await post(familiar.token, rota, corpo({ refeicao: "jantar" }));
    const l5 = await prisma.registroAlimentar.findMany({ where: { idoso_id: idoso.id, registrado_por_id: familiar.id } });
    ok(
      "familiar com modo_decisao 'familiar': 201 e registrado_por_id do familiar",
      r5.status === 201 && l5.length === 1 && l5[0].idoso_id === idoso.id && l5[0].refeicao === "jantar",
      `status ${r5.status}, ${l5.length} linha(s)`,
    );

    // 5: cuidador com as 3 flags true (e modo_decisao 'familiar' no idoso): 403 e nenhuma linha, nas duas rotas.
    const n6 = await contarRegistros();
    const r6 = await post(cuidador.token, rota, corpo());
    const r7 = await post(cuidador.token, "/alimentacao", corpo());
    ok(
      "cuidador com as 3 flags true: 403 nas duas rotas e nenhuma linha",
      r6.status === 403 && r7.status === 403 && (await contarRegistros()) === n6,
      `status ${r6.status}/${r7.status}`,
    );

    // 6: vínculo pendente: 403 e nenhuma linha.
    const n8 = await contarRegistros();
    const r8 = await post(familiarPend.token, rota, corpo());
    ok("familiar com vínculo pendente: 403 e nenhuma linha", r8.status === 403 && (await contarRegistros()) === n8, `status ${r8.status}`);

    // 7: refeicao fora da lista e data inexistente: 400 e nenhuma linha.
    const n9 = await contarRegistros();
    const r9 = await post(idoso.token, "/alimentacao", corpo({ refeicao: "Almoco" }));
    const r10 = await post(idoso.token, "/alimentacao", corpo({ data_hora: "2026-02-30T10:00:00Z" }));
    ok(
      "refeicao 'Almoco' e data 30/02: 400 e nenhuma linha",
      r9.status === 400 && r10.status === 400 && (await contarRegistros()) === n9,
      `status ${r9.status}/${r10.status}`,
    );

    // 8: contagem durante = antes + 3 (idoso: almoco e ceia; familiar: jantar).
    const durante = await contarRegistros();
    ok("COUNT(*) de RegistroAlimentar durante = antes + 3", durante === registrosAntes + 3, `antes ${registrosAntes}, durante ${durante}`);
  } finally {
    // Ordem de FK: registros, vínculos, contas.
    await prisma.registroAlimentar.deleteMany({
      where: { OR: [{ idoso_id: { in: usuarios } }, { registrado_por_id: { in: usuarios } }] },
    });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    ok("COUNT(*) de RegistroAlimentar depois da limpeza = antes", (await contarRegistros()) === registrosAntes, `antes ${registrosAntes}`);
    ok("COUNT(*) de Usuario depois da limpeza = antes", (await contarUsuarios()) === usuariosAntes, `antes ${usuariosAntes}`);
    const vinculosDepois = await contarVinculos();
    ok("COUNT(*) de Vinculo depois da limpeza = antes", vinculosDepois === vinculosAntes, `antes ${vinculosAntes}, depois ${vinculosDepois}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: `verify-alim-${tag}` } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
    process.stdout.write = outOriginal;
    process.stderr.write = errOriginal;
    const vazou = capturado.join("").split(sentinela).length - 1;
    ok("0 ocorrências da sentinela em stdout e stderr", vazou === 0, `${vazou} ocorrência(s)`);
  }

  console.log("\nCenário".padEnd(84) + "Resultado");
  console.log("-".repeat(108));
  for (const r of results) console.log(r.name.padEnd(84) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
