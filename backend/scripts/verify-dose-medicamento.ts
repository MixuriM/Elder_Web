// Verifica contra o banco real o que os testes das rotas de dose (RF-012, item 5.2) só conseguem
// simular com Prisma mockado, sobre RegistroDoseMedicamento:
//   1. create válido com os 3 valores de status_administracao e com observacoes nula;
//   2. CHECK CK_RegistroDoseMedicamento_status_administracao rejeita valor fora do enum (a caixa diferente é só informativa, ver abaixo);
//   3. NVarChar(300) aceita observacoes de 300 e rejeita 301;
//   4. FK de medicamento_id e de registrado_por_id inexistentes são rejeitadas;
//   5. datetime2 é gravado e relido como o MESMO instante (sem deslocamento de fuso, com milissegundos);
//   6. COUNT(*) de RegistroDoseMedicamento é igual antes e depois.
// Cada caso roda numa transação sempre revertida (nenhum dado é commitado). Não loga valores de dose:
// só PASS/FAIL e o que o caso verificou.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;..." npx tsx scripts/verify-dose-medicamento.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

class ForceRollback extends Error {}

type Tx = Prisma.TransactionClient;
type Resultado = { pass: boolean; detail: string };
type Ctx = { idosoId: number; medicamentoId: number };

const results: { name: string; pass: boolean; detail: string }[] = [];

async function caso(name: string, fn: (tx: Tx, ctx: Ctx) => Promise<Resultado>) {
  try {
    await prisma.$transaction(async (tx) => {
      const idoso = await tx.usuario.create({
        data: {
          firebase_uid: randomUUID(),
          nome: "Idoso de Teste",
          email: `${randomUUID()}@teste.local`,
          tipo_perfil: "idoso",
        },
      });
      const med = await tx.medicamento.create({
        data: {
          idoso_id: idoso.id,
          criado_por_id: idoso.id,
          editado_por_id: null,
          nome: "Medicamento de Teste",
          dosagem: "10 mg",
          frequencia: "2x ao dia",
          data_inicio: new Date("2026-10-01T00:00:00.000Z"),
          ativo: true,
        },
      });
      results.push({ name, ...(await fn(tx, { idosoId: idoso.id, medicamentoId: med.id })) });
      throw new ForceRollback();
    });
  } catch (e) {
    if (!(e instanceof ForceRollback)) {
      results.push({ name, pass: false, detail: `erro inesperado: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}` });
    }
  }
}

function base(c: Ctx, over: Partial<Prisma.RegistroDoseMedicamentoUncheckedCreateInput> = {}): Prisma.RegistroDoseMedicamentoUncheckedCreateInput {
  return {
    medicamento_id: c.medicamentoId,
    registrado_por_id: c.idosoId,
    data_hora_administracao: new Date("2026-10-02T08:30:00.000Z"),
    status_administracao: "administrado",
    ...over,
  };
}

// Nunca inclui a mensagem do erro no detalhe.
async function rejeitado(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

async function main() {
  exigirBancoLocal();
  const antes = await prisma.registroDoseMedicamento.count();

  await caso("create válido com observacoes nula", async (tx, c) => {
    const d = await tx.registroDoseMedicamento.create({ data: base(c) });
    return { pass: d.observacoes === null && d.registrado_por_id === c.idosoId, detail: "observacoes nula e autoria gravadas" };
  });

  await caso("CHECK aceita administrado, pulado e atrasado", async (tx, c) => {
    for (const status of ["administrado", "pulado", "atrasado"]) {
      await tx.registroDoseMedicamento.create({ data: base(c, { status_administracao: status }) });
    }
    const n = await tx.registroDoseMedicamento.count({ where: { medicamento_id: c.medicamentoId } });
    return { pass: n === 3, detail: `${n}/3 valores válidos aceitos` };
  });

  for (const [rotulo, valor] of [
    ["valor desconhecido", "tomado"],
    ["vazio", ""],
    ["com espaço", " administrado"],
  ] as const) {
    await caso(`CHECK rejeita status ${rotulo}`, async (tx, c) => {
      const rej = await rejeitado(() => tx.registroDoseMedicamento.create({ data: base(c, { status_administracao: valor }) }));
      return { pass: rej, detail: rej ? "banco rejeitou" : "banco ACEITOU status fora do enum" };
    });
  }

  // Informativo (sempre PASS): a collation padrão do SQL Server é case-insensitive, então o CHECK aceita
  // "ADMINISTRADO". A rota rejeita a caixa diferente antes (400); o banco sozinho não. Registra o que foi medido.
  await caso("INFO: CHECK com status em caixa diferente (collation)", async (tx, c) => {
    const rej = await rejeitado(() => tx.registroDoseMedicamento.create({ data: base(c, { status_administracao: "ADMINISTRADO" }) }));
    return { pass: true, detail: rej ? "banco rejeitou" : "banco ACEITOU (collation CI); só a rota barra" };
  });

  await caso("NVarChar(300) aceita observacoes de 300", async (tx, c) => {
    const d = await tx.registroDoseMedicamento.create({ data: base(c, { observacoes: "o".repeat(300) }) });
    return { pass: d.observacoes?.length === 300, detail: "limite exato gravado sem truncar" };
  });

  await caso("NVarChar(300) rejeita observacoes de 301", async (tx, c) => {
    const rej = await rejeitado(() => tx.registroDoseMedicamento.create({ data: base(c, { observacoes: "o".repeat(301) }) }));
    return { pass: rej, detail: rej ? "banco rejeitou" : "banco ACEITOU acima do limite" };
  });

  await caso("FK de medicamento_id inexistente é rejeitada", async (tx, c) => {
    const rej = await rejeitado(() => tx.registroDoseMedicamento.create({ data: base(c, { medicamento_id: 2147483647 }) }));
    return { pass: rej, detail: rej ? "FK barrou" : "FK NÃO barrou" };
  });

  await caso("FK de registrado_por_id inexistente é rejeitada", async (tx, c) => {
    const rej = await rejeitado(() => tx.registroDoseMedicamento.create({ data: base(c, { registrado_por_id: 2147483647 }) }));
    return { pass: rej, detail: rej ? "FK barrou" : "FK NÃO barrou" };
  });

  await caso("datetime2 gravado e relido como o mesmo instante", async (tx, c) => {
    const instantes = ["2026-01-01T00:00:00.000Z", "2026-10-02T08:30:15.123Z", "2026-12-31T23:59:59.999Z"];
    const desvios: string[] = [];
    for (const iso of instantes) {
      const criado = await tx.registroDoseMedicamento.create({ data: base(c, { data_hora_administracao: new Date(iso) }) });
      const lido = await tx.registroDoseMedicamento.findUniqueOrThrow({ where: { id: criado.id } });
      if (lido.data_hora_administracao.toISOString() !== iso) desvios.push(iso);
    }
    return { pass: desvios.length === 0, detail: desvios.length === 0 ? `${instantes.length} instantes sem deslocamento` : `${desvios.length} instante(s) deslocado(s)` };
  });

  const depois = await prisma.registroDoseMedicamento.count();
  results.push({
    name: "COUNT(*) de RegistroDoseMedicamento igual antes e depois",
    pass: antes === depois,
    detail: `antes ${antes}, depois ${depois}`,
  });

  console.log("\nCaso".padEnd(62) + "Resultado");
  console.log("-".repeat(80));
  for (const r of results) {
    console.log(r.name.padEnd(62) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  }
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Erro fatal no script de verificação:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
