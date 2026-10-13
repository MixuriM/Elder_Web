// Medição local de desempenho das rotas de leitura (tarefa de desempenho, 2026-10-13). Fora do CI.
// Rota REAL (app de ./app via Supertest), Prisma REAL e SQL Server LOCAL, mesmo padrão dos verify-rotas-*:
// só auth.verifyIdToken é trocado (o "token" é o firebase_uid da conta de teste), sem rede ao Firebase.
//
// Volume (decisão D2): 1 idoso com 5.000 registros de saúde, 5.000 refeições, 3.000 eventos, 200
// medicamentos com 20 doses cada e 20 vínculos. --fundo=N acrescenta N idosos com o mesmo volume, para
// medir o efeito de índice quando a tabela tem dado de outros idosos (seletividade real de produção).
//
// Contagem de queries: o PrismaClient do app é embrulhado ANTES de ./app carregar, com um $extends que só
// incrementa um contador (sem log, sem args). Conta operações do Prisma: findMany com include gera mais de
// um SQL por operação.
//
// Planos: depois das latências, lê sys.dm_exec_query_stats e sys.dm_exec_query_plan das consultas que
// tocam as tabelas medidas e imprime só tabela, leituras lógicas por execução e o operador de acesso.
// Nunca imprime valor, e-mail, token, texto de SQL nem DATABASE_URL.
//
// Limpeza: toda conta criada tem firebase_uid com prefixo perf-<tag>-. O finally apaga só as linhas dessas
// contas (doses, saúde, refeições, eventos, vínculos, medicamentos, contas) e confere o COUNT(*) inicial.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=${MSSQL_SA_PASSWORD};encrypt=true;trustServerCertificate=true" \
//     npx tsx scripts/medir-desempenho.ts [--fundo=9] [--saida=arquivo.json]
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { brotliCompressSync } from "node:zlib";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
const FUNDO = Number(arg("fundo") ?? 0);
const SAIDA = arg("saida");
// --latencia-db=N: atraso fixo de N ms antes de cada operação do Prisma, só neste script. Simula a ida e volta
// da rede entre o backend e o banco (Render e Azure ficam em datacenters diferentes; local é menos de 1 ms),
// para medir o efeito de consultas em série contra consultas em paralelo.
const LATENCIA_DB = Number(arg("latencia-db") ?? 0);
const AQUECIMENTO = 5;
const CHAMADAS = 30;

let queries = 0;

function embrulharPrismaClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@prisma/client") as { PrismaClient: new (...a: unknown[]) => { $extends: (e: unknown) => unknown } };
  const Original = mod.PrismaClient;
  mod.PrismaClient = function (...a: unknown[]) {
    return new Original(...a).$extends({
      query: {
        async $allOperations({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
          queries++;
          if (LATENCIA_DB > 0) await new Promise((r) => setTimeout(r, LATENCIA_DB));
          return query(args);
        },
      },
    });
  } as unknown as typeof mod.PrismaClient;
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const p95 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
};
const r1 = (n: number) => Math.round(n * 10) / 10;

type Linha = { rota: string; status: number; mediana_ms: number; p95_ms: number; queries: number; bytes: number; bytes_br: number };

async function main() {
  exigirBancoLocal();
  embrulharPrismaClient();
  const { default: request } = await import("supertest");
  const t0 = performance.now();
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");
  const { requireAuth } = await import("../src/middleware/requireAuth");
  const { requireVinculoAprovado } = await import("../src/middleware/requireVinculoAprovado");
  const tImport = performance.now() - t0;
  const t1 = performance.now();
  await prisma.usuario.count({ where: { id: -1 } });
  const tPrimeiraQuery = performance.now() - t1;

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({
    uid: t,
    email_verified: true,
  });

  const tag = randomUUID().slice(0, 8);
  const prefixo = `perf-${tag}-`;
  const tabelas = async () => ({
    usuario: await prisma.usuario.count(),
    vinculo: await prisma.vinculo.count(),
    saude: await prisma.registroSaude.count(),
    alim: await prisma.registroAlimentar.count(),
    evento: await prisma.evento.count(),
    med: await prisma.medicamento.count(),
    dose: await prisma.registroDoseMedicamento.count(),
  });
  const antes = await tabelas();

  async function conta(perfil: "idoso" | "cuidador" | "familiar", extra: Record<string, unknown> = {}) {
    const uid = `${prefixo}${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta perf", email: `${uid}@e2e.elderweb.test`, tipo_perfil: perfil, modo_decisao: null, ...extra },
      select: { id: true },
    });
    return { id: u.id, token: uid };
  }

  // --popular-email: datas em volta de agora (a Agenda e o calendário Mês mostram o mês corrente).
  const base = arg("popular-email") ? Date.now() - 1500 * 37 * 60_000 : Date.UTC(2026, 0, 1);
  const quando = (i: number) => new Date(base + i * 37 * 60_000);

  async function popularIdoso(idosoId: number) {
    const lote = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
    for (let i = 0; i < 5000; i += 1000) {
      await prisma.registroSaude.createMany({
        data: lote(1000, (j) => ({
          idoso_id: idosoId, registrado_por_id: idosoId, editado_por_id: idosoId, tipo_medicao: "pressao",
          valor_1: "120", valor_2: "80", unidade: "mmHg", data_hora: quando(i + j), observacoes: null,
        })),
      });
      await prisma.registroAlimentar.createMany({
        data: lote(1000, (j) => ({ idoso_id: idosoId, registrado_por_id: idosoId, refeicao: "almoco", descricao: "Refeição perf", data_hora: quando(i + j) })),
      });
    }
    for (let i = 0; i < 3000; i += 1000) {
      await prisma.evento.createMany({
        data: lote(1000, (j) => ({ idoso_id: idosoId, criado_por_id: idosoId, tipo_evento: "pessoal", titulo: "Evento perf", data_hora_inicio: quando(i + j) })),
      });
    }
    await prisma.medicamento.createMany({
      data: lote(200, (i) => ({
        idoso_id: idosoId, criado_por_id: idosoId, nome: `Med perf ${i}`, dosagem: "10 mg", frequencia: "1x",
        data_inicio: new Date(base + i * 86_400_000), ativo: i % 2 === 0,
      })),
    });
    const meds = await prisma.medicamento.findMany({ where: { idoso_id: idosoId }, select: { id: true } });
    for (let i = 0; i < meds.length; i += 50) {
      await prisma.registroDoseMedicamento.createMany({
        data: meds.slice(i, i + 50).flatMap((m) =>
          lote(20, (j) => ({ medicamento_id: m.id, registrado_por_id: idosoId, data_hora_administracao: quando(m.id * 20 + j), status_administracao: "administrado" })),
        ),
      });
    }
  }

  // Modos usados por frontend/e2e/desempenho.spec.ts: popula (ou limpa) o volume D2 de um idoso e2e já
  // criado pela UI no banco LOCAL. A conta e os vínculos ficam (contas e2e não têm limpeza automática).
  const emailAlvo = arg("popular-email") ?? arg("limpar-email");
  if (emailAlvo) {
    if (!emailAlvo.endsWith("@e2e.elderweb.test")) throw new Error("Só conta de teste @e2e.elderweb.test.");
    const alvo = await prisma.usuario.findFirst({ where: { email: emailAlvo, tipo_perfil: "idoso" }, select: { id: true } });
    if (!alvo) throw new Error("Idoso de teste não encontrado.");
    const meds = (await prisma.medicamento.findMany({ where: { idoso_id: alvo.id }, select: { id: true } })).map((m) => m.id);
    await prisma.registroDoseMedicamento.deleteMany({ where: { medicamento_id: { in: meds } } });
    await prisma.medicamento.deleteMany({ where: { idoso_id: alvo.id } });
    await prisma.registroSaude.deleteMany({ where: { idoso_id: alvo.id } });
    await prisma.registroAlimentar.deleteMany({ where: { idoso_id: alvo.id } });
    await prisma.evento.deleteMany({ where: { idoso_id: alvo.id } });
    if (arg("popular-email")) await popularIdoso(alvo.id);
    process.stdout.write(`${arg("popular-email") ? "Populado" : "Limpo"}: idoso de teste.
`);
    await prisma.$disconnect();
    return;
  }

  const resultado: { fundo: number; import_app_ms: number; primeira_query_ms: number; rotas: Linha[]; middlewares: Linha[]; planos: unknown[] } = {
    fundo: FUNDO, import_app_ms: r1(tImport), primeira_query_ms: r1(tPrimeiraQuery), rotas: [], middlewares: [], planos: [],
  };

  try {
    // modo_decisao 'familiar': o familiar aprovado vira titular e GET /vinculo percorre os 3 findMany.
    const idoso = await conta("idoso", { modo_decisao: "familiar", foto_perfil: randomBytes(60_000), foto_perfil_mime_type: "image/webp", foto_perfil_atualizada_em: new Date() });
    await popularIdoso(idoso.id);
    const vinculados: { id: number; token: string; tipo: "cuidador" | "familiar" }[] = [];
    for (let i = 0; i < 20; i++) {
      const tipo = i < 10 ? "cuidador" : "familiar";
      const c = await conta(tipo);
      vinculados.push({ ...c, tipo });
      const status = i % 5 === 4 ? "pendente" : "aprovado";
      await prisma.vinculo.create({
        data: {
          idoso_id: idoso.id, vinculado_id: c.id, tipo_vinculo: tipo,
          origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
          status, aprovador_id: status === "aprovado" ? idoso.id : null, data_solicitacao: quando(i),
        },
      });
    }
    for (let k = 0; k < FUNDO; k++) {
      const outro = await conta("idoso");
      await popularIdoso(outro.id);
    }
    const cuidador = vinculados[0];
    const familiar = vinculados[10];

    const medir = async (rota: string, fazer: () => Promise<{ status: number; bytes: number; corpo?: Buffer }>) => {
      for (let i = 0; i < AQUECIMENTO; i++) await fazer();
      const tempos: number[] = [];
      let status = 0;
      let bytes = 0;
      let corpo: Buffer | undefined;
      const q0 = queries;
      for (let i = 0; i < CHAMADAS; i++) {
        const t = performance.now();
        const r = await fazer();
        tempos.push(performance.now() - t);
        status = r.status;
        bytes = r.bytes;
        corpo = r.corpo;
      }
      // Referência: o Render comprime a resposta (Brotli por padrão); o tamanho local é o sem compressão.
      const bytes_br = corpo ? brotliCompressSync(corpo).length : 0;
      const linha = { rota, status, mediana_ms: r1(mediana(tempos)), p95_ms: r1(p95(tempos)), queries: r1((queries - q0) / CHAMADAS), bytes, bytes_br };
      process.stdout.write(`${rota.padEnd(44)} ${String(status).padEnd(4)} med ${String(linha.mediana_ms).padStart(7)} ms  p95 ${String(linha.p95_ms).padStart(7)} ms  q/req ${String(linha.queries).padStart(4)}  ${bytes} B\n`);
      return linha;
    }

    const http = (metodo: "get" | "post", token: string, caminho: string) => async () => {
      const r = await request(app)[metodo](caminho).set("Authorization", `Bearer ${token}`).buffer(true)
        .parse((res, cb) => {
          const partes: Buffer[] = [];
          res.on("data", (c: Buffer) => partes.push(c));
          res.on("end", () => cb(null, Buffer.concat(partes)));
        });
      const corpo = r.body as Buffer;
      return { status: r.status, bytes: corpo.length, corpo };
    };

    const rotas: [string, "get" | "post", string, string][] = [
      ["GET /vinculo (idoso, 20 vínculos)", "get", idoso.token, "/vinculo"],
      ["GET /vinculo (cuidador)", "get", cuidador.token, "/vinculo"],
      ["GET /vinculo (familiar titular)", "get", familiar.token, "/vinculo"],
      ["GET /vinculo?status=aprovado (familiar)", "get", familiar.token, "/vinculo?status=aprovado"],
      ["GET /saude (idoso)", "get", idoso.token, "/saude"],
      ["GET /saude/idoso/:id (familiar)", "get", familiar.token, `/saude/idoso/${idoso.id}`],
      ["GET /remedios (idoso)", "get", idoso.token, "/remedios"],
      ["GET /remedios/idoso/:id (cuidador)", "get", cuidador.token, `/remedios/idoso/${idoso.id}`],
      ["GET /alimentacao (idoso)", "get", idoso.token, "/alimentacao"],
      ["GET /alimentacao/idoso/:id (familiar)", "get", familiar.token, `/alimentacao/idoso/${idoso.id}`],
      ["GET /agenda (idoso)", "get", idoso.token, "/agenda"],
      ["GET /agenda/idoso/:id (cuidador)", "get", cuidador.token, `/agenda/idoso/${idoso.id}`],
      ["GET /historico/pdf (idoso)", "get", idoso.token, "/historico/pdf"],
      ["GET /historico/idoso/:id/pdf (familiar)", "get", familiar.token, `/historico/idoso/${idoso.id}/pdf`],
      ["GET /usuario/me (idoso)", "get", idoso.token, "/usuario/me"],
      ["GET /usuario/me/foto (idoso, 60 kB)", "get", idoso.token, "/usuario/me/foto"],
      ["POST /auth/sync (idoso existente)", "post", idoso.token, "/auth/sync"],
    ];
    // Só a ordem de execução: --so=vinculo filtra rotas pelo texto, para medir rápido um item isolado.
    const so = arg("so");
    // Zera o cache de planos do SQL Server LOCAL (exigirBancoLocal já barrou outro host): as estatísticas
    // lidas no fim vêm só desta execução.
    await prisma.$executeRaw`DBCC FREEPROCCACHE`;
    for (const [nome, metodo, token, caminho] of rotas) {
      if (so && !nome.includes(so)) continue;
      resultado.rotas.push(await medir(nome, http(metodo, token, caminho)));
    }

    // Middlewares isolados, sem Express: req/res mínimos.
    const resFalso = () => {
      const r = { statusCode: 200, status(c: number) { r.statusCode = c; return r; }, json() { return r; } };
      return r;
    };
    if (!so) {
      resultado.middlewares.push(
        await medir("requireAuth (isolado)", async () => {
          const req = { headers: { authorization: `Bearer ${familiar.token}` } } as never;
          const res = resFalso();
          await requireAuth(req, res as never, () => {});
          return { status: res.statusCode, bytes: 0 };
        }),
      );
      const mw = requireVinculoAprovado("idosoId");
      resultado.middlewares.push(
        await medir("requireVinculoAprovado (isolado)", async () => {
          const req = { usuarioId: familiar.id, params: { idosoId: String(idoso.id) } } as never;
          const res = resFalso();
          await mw(req, res as never, () => {});
          return { status: res.statusCode, bytes: 0 };
        }),
      );
    }

    {
      // Planos das consultas que rodaram (cache de planos do SQL Server local). Só agregados.
      type Plano = { tabela: string; execucoes: number; leituras_por_exec: number; acesso: string };
      const linhas = await prisma.$queryRaw<{ texto: string; execs: bigint; leituras: bigint; plano: string | null }[]>`
        SELECT st.text AS texto, qs.execution_count AS execs, qs.total_logical_reads AS leituras,
               CAST(qp.query_plan AS NVARCHAR(MAX)) AS plano
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
        CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
        WHERE st.text LIKE '%FROM %' AND qs.execution_count >= ${CHAMADAS}`;
      const tabelasMedidas = ["RegistroSaude", "RegistroAlimentar", "Evento", "Medicamento", "RegistroDoseMedicamento", "Vinculo"];
      const planos: Plano[] = [];
      for (const l of linhas) {
        const from = /FROM \[dbo\]\.\[(\w+)\]/.exec(l.texto)?.[1];
        if (!from || !tabelasMedidas.includes(from) || !l.plano) continue;
        const ops = [...l.plano.matchAll(/PhysicalOp="((?:Clustered )?Index (?:Scan|Seek)|Table Scan|Key Lookup|RID Lookup)"[^>]*?>[\s\S]*?<Object [^>]*Table="\[(\w+)\]"(?: Index="\[(\w+)\]")?/g)]
          .filter((m) => m[2] === from)
          .map((m) => `${m[1]}${m[3] ? ` ${m[3]}` : ""}`);
        const filtros = [...l.texto.matchAll(/WHERE \(?(?:\(?\[dbo\]\.\[\w+\]\.\[(\w+)\])/g)].map((m) => m[1]);
        planos.push({
          tabela: `${from}${filtros.length ? ` (WHERE ${filtros[0]})` : ""}`,
          execucoes: Number(l.execs),
          leituras_por_exec: r1(Number(l.leituras) / Number(l.execs)),
          acesso: [...new Set(ops)].join(", ") || "?",
        });
      }
      planos.sort((a, b) => b.leituras_por_exec - a.leituras_por_exec);
      process.stdout.write("\nPlanos (leituras lógicas por execução, operador de acesso):\n");
      for (const p of planos) process.stdout.write(`${p.tabela.padEnd(48)} execs ${String(p.execucoes).padStart(5)}  leituras ${String(p.leituras_por_exec).padStart(8)}  ${p.acesso}\n`);
      resultado.planos = planos;
    }
  } finally {
    const contasTeste = (await prisma.usuario.findMany({ where: { firebase_uid: { startsWith: prefixo } }, select: { id: true } })).map((u) => u.id);
    const meds = (await prisma.medicamento.findMany({ where: { idoso_id: { in: contasTeste } }, select: { id: true } })).map((m) => m.id);
    for (let i = 0; i < meds.length; i += 1000) {
      await prisma.registroDoseMedicamento.deleteMany({ where: { medicamento_id: { in: meds.slice(i, i + 1000) } } });
    }
    await prisma.registroSaude.deleteMany({ where: { idoso_id: { in: contasTeste } } });
    await prisma.registroAlimentar.deleteMany({ where: { idoso_id: { in: contasTeste } } });
    await prisma.evento.deleteMany({ where: { idoso_id: { in: contasTeste } } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: contasTeste } }, { vinculado_id: { in: contasTeste } }] } });
    await prisma.medicamento.deleteMany({ where: { idoso_id: { in: contasTeste } } });
    await prisma.usuario.deleteMany({ where: { id: { in: contasTeste } } });
    const depois = await tabelas();
    const iguais = JSON.stringify(depois) === JSON.stringify(antes);
    if (!iguais) {
      console.error(`FALHA: a limpeza deixou resíduo. Antes ${JSON.stringify(antes)}, depois ${JSON.stringify(depois)}.`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`\nLimpeza ok: COUNT(*) igual ao inicial nas 7 tabelas. import do app ${resultado.import_app_ms} ms, primeira query ${resultado.primeira_query_ms} ms.\n`);
    }
    await prisma.$disconnect();
  }
  if (SAIDA) writeFileSync(SAIDA, JSON.stringify(resultado, null, 2));
}

main().catch((e) => {
  console.error("Erro fatal no script de medição:", (e as Error).name, String((e as { code?: unknown }).code ?? ""), JSON.stringify((e as { meta?: { field_name?: unknown } }).meta?.field_name ?? ""));
  process.exitCode = 1;
});
