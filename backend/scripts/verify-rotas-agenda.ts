// Verificação ponta a ponta do item 6.1 (RF-015): rota REAL (app de ./app via Supertest), Prisma REAL e
// SQL Server LOCAL. Os testes de Jest mockam o Prisma; este script exercita o caminho inteiro junto,
// inclusive a CHECK CK_Evento_tipo_evento do banco.
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken passa a devolver { uid: <token> },
// então o "token" enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e
// nenhuma chamada de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida. Todo dado
// criado (contas, vínculos, eventos) é rastreado e apagado no finally; o COUNT(*) de Evento e de Usuario
// é conferido antes e depois. O prefixo `verify-agenda-` no firebase_uid marca conta residual se o processo
// for morto no meio. Título e descrição levam uma sentinela única: o script confere 0 ocorrência dela em
// stdout e stderr (o próprio relatório não imprime valores de evento).
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=...;encrypt=true;trustServerCertificate=true" npx tsx scripts/verify-rotas-agenda.ts
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
  const sentinela = `sentinela-agenda-${randomUUID()}`;
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
    const uid = `verify-agenda-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: modo },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid };
  }

  async function vincular(idosoId: number, vinculadoId: number, tipo: "cuidador" | "familiar", flags = false) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status: "aprovado",
        aprovador_id: idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: flags,
        permite_registrar_saude: flags,
        permite_criar_evento_cuidado: flags,
      },
    });
  }

  const eventosDe = (idosoId: number) => prisma.evento.findMany({ where: { idoso_id: idosoId }, orderBy: { id: "asc" } });
  const contarEventos = () => prisma.evento.count();
  const contarUsuarios = () => prisma.usuario.count();
  const post = (token: string, caminho: string, corpo: object) =>
    request(app).post(caminho).set("Authorization", `Bearer ${token}`).send(corpo);
  const corpo = (tipo: string, over: object = {}) => ({
    tipo_evento: tipo,
    titulo: `${sentinela}-titulo`,
    descricao: `${sentinela}-descricao`,
    data_hora_inicio: "2026-10-10T09:00:00-03:00",
    ...over,
  });

  const eventosAntes = await contarEventos();
  const usuariosAntes = await contarUsuarios();
  try {
    const idoso = await conta("idoso");
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    await vincular(idoso.id, cuidador.id, "cuidador", true);
    await vincular(idoso.id, familiar.id, "familiar");

    // 1: idoso cria 'pessoal' e 'medico'.
    const r1 = await post(idoso.token, "/agenda", corpo("pessoal"));
    const r2 = await post(idoso.token, "/agenda", corpo("medico"));
    const l1 = await eventosDe(idoso.id);
    ok(
      "idoso cria 'pessoal' e 'medico': 201 e criado_por_id/idoso_id do idoso",
      r1.status === 201 && r2.status === 201 && l1.length === 2 && l1.every((e) => e.criado_por_id === idoso.id && e.idoso_id === idoso.id && e.editado_por_id === null),
      `status ${r1.status}/${r2.status}, ${l1.length} linha(s)`,
    );

    // 2: 09:00-03:00 gravado como 12:00Z e lido de volta.
    const lido = l1[0]?.data_hora_inicio.toISOString();
    ok("09:00-03:00 gravado como 12:00Z e lido de volta", lido === "2026-10-10T12:00:00.000Z" && r1.body.data_hora_inicio === "2026-10-10T12:00:00.000Z", `lido ${lido}`);

    // 3: 'cuidado' pelo idoso: 403 e nenhuma linha.
    const n3 = await contarEventos();
    const r3 = await post(idoso.token, "/agenda", corpo("cuidado"));
    ok("'cuidado' pelo idoso: 403 e nenhuma linha", r3.status === 403 && (await contarEventos()) === n3, `status ${r3.status}`);

    // 4: familiar conforme modo_decisao do idoso (NULL e 'idoso' valem 'idoso').
    const rota = `/agenda/idoso/${idoso.id}`;
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const n4 = await contarEventos();
    const r4 = await post(familiar.token, rota, corpo("pessoal"));
    ok("familiar com modo_decisao 'idoso': 403 e nenhuma linha", r4.status === 403 && (await contarEventos()) === n4, `status ${r4.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const r5 = await post(familiar.token, rota, corpo("medico"));
    const l5 = await prisma.evento.findMany({ where: { idoso_id: idoso.id, criado_por_id: familiar.id } });
    ok("familiar com modo_decisao 'familiar': 201 e criado_por_id do familiar", r5.status === 201 && l5.length === 1 && l5[0].idoso_id === idoso.id, `status ${r5.status}, ${l5.length} linha(s)`);

    // 5: familiar com 'cuidado' e cuidador (com as 3 flags) na rota por vínculo.
    const n5 = await contarEventos();
    const r6 = await post(familiar.token, rota, corpo("cuidado"));
    const r7 = await post(cuidador.token, rota, corpo("pessoal"));
    ok("familiar com 'cuidado' e cuidador com 3 flags: 403 e nenhuma linha", r6.status === 403 && r7.status === 403 && (await contarEventos()) === n5, `status ${r6.status}/${r7.status}`);

    // 6: INSERT direto com tipo inválido falha pela CHECK do banco (e o 'cuidado' direto é aceito: é do 6.2).
    let erroCheck = "";
    try {
      await prisma.evento.create({
        data: { idoso_id: idoso.id, criado_por_id: idoso.id, tipo_evento: "invalido", titulo: "Teste", data_hora_inicio: new Date("2026-10-10T12:00:00Z") },
      });
    } catch (e) {
      erroCheck = String((e as { message?: unknown }).message ?? "");
    }
    ok("INSERT direto com tipo_evento inválido falha por CK_Evento_tipo_evento", erroCheck.includes("CK_Evento_tipo_evento"), erroCheck ? "violou a constraint" : "NÃO falhou");

    // 7: contagem durante = antes + 3 eventos criados pelas rotas (idoso: pessoal e medico; familiar: medico).
    const durante = await contarEventos();
    ok("COUNT(*) de Evento durante = antes + 3", durante === eventosAntes + 3, `antes ${eventosAntes}, durante ${durante}`);
  } finally {
    // Ordem de FK: eventos, vínculos, contas.
    await prisma.evento.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { criado_por_id: { in: usuarios } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    ok("COUNT(*) de Evento depois da limpeza = antes", (await contarEventos()) === eventosAntes, `antes ${eventosAntes}`);
    ok("COUNT(*) de Usuario depois da limpeza = antes", (await contarUsuarios()) === usuariosAntes, `antes ${usuariosAntes}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: `verify-agenda-${tag}` } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
    process.stdout.write = outOriginal;
    process.stderr.write = errOriginal;
    const vazou = capturado.join("").split(sentinela).length - 1;
    ok("0 ocorrências da sentinela em stdout e stderr", vazou === 0, `${vazou} ocorrência(s)`);
  }

  console.log("\nCenário".padEnd(76) + "Resultado");
  console.log("-".repeat(100));
  for (const r of results) console.log(r.name.padEnd(76) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
