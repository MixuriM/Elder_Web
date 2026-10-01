// Verifica contra o banco real o que os testes de POST /remedios (RF-011, item 5.1) só
// conseguem simular com Prisma mockado:
//   1. create válido sem data_fim e sem observacoes, e com os dois;
//   2. NVarChar aceita nome 150, dosagem 50, frequencia 100, observacoes 500 e rejeita 151/51/101/501;
//   3. @db.Date é gravado e relido como o MESMO dia (sem deslocamento de fuso);
//   4. ativo é gravado como bit (true relido como true);
//   5. FK de idoso_id e de criado_por_id inexistentes são rejeitadas;
//   6. COUNT(*) de Medicamento é igual antes e depois.
// Cada caso roda numa transação sempre revertida (nenhum dado é commitado). Não loga valores de
// medicamento: só PASS/FAIL e o que o caso verificou.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;..." npx tsx scripts/verify-medicamento.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

class ForceRollback extends Error {}

type Tx = Prisma.TransactionClient;
type Resultado = { pass: boolean; detail: string };

const results: { name: string; pass: boolean; detail: string }[] = [];

async function caso(name: string, fn: (tx: Tx, idosoId: number) => Promise<Resultado>) {
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
      results.push({ name, ...(await fn(tx, idoso.id)) });
      throw new ForceRollback();
    });
  } catch (e) {
    if (!(e instanceof ForceRollback)) {
      results.push({ name, pass: false, detail: `erro inesperado: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}` });
    }
  }
}

function base(idosoId: number, over: Partial<Prisma.MedicamentoUncheckedCreateInput> = {}): Prisma.MedicamentoUncheckedCreateInput {
  return {
    idoso_id: idosoId,
    criado_por_id: idosoId,
    editado_por_id: null,
    nome: "Medicamento de Teste",
    dosagem: "10 mg",
    frequencia: "2x ao dia",
    data_inicio: new Date("2026-10-01T00:00:00.000Z"),
    ativo: true,
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
  const antes = await prisma.medicamento.count();

  await caso("create válido sem data_fim e sem observacoes", async (tx, id) => {
    const m = await tx.medicamento.create({ data: base(id) });
    return {
      pass: m.data_fim === null && m.observacoes === null && m.editado_por_id === null,
      detail: "data_fim, observacoes e editado_por_id nulos aceitos",
    };
  });

  await caso("create válido com data_fim e observacoes", async (tx, id) => {
    const m = await tx.medicamento.create({
      data: base(id, { data_fim: new Date("2026-12-31T00:00:00.000Z"), observacoes: "obs de teste" }),
    });
    return { pass: m.data_fim !== null && m.observacoes === "obs de teste", detail: "campos opcionais gravados e relidos" };
  });

  await caso("NVarChar aceita 150/50/100/500", async (tx, id) => {
    const m = await tx.medicamento.create({
      data: base(id, { nome: "n".repeat(150), dosagem: "d".repeat(50), frequencia: "f".repeat(100), observacoes: "o".repeat(500) }),
    });
    const pass = m.nome.length === 150 && m.dosagem.length === 50 && m.frequencia.length === 100 && m.observacoes?.length === 500;
    return { pass, detail: "limites exatos gravados sem truncar" };
  });

  const acimaDoLimite: [string, Partial<Prisma.MedicamentoUncheckedCreateInput>][] = [
    ["nome 151", { nome: "n".repeat(151) }],
    ["dosagem 51", { dosagem: "d".repeat(51) }],
    ["frequencia 101", { frequencia: "f".repeat(101) }],
    ["observacoes 501", { observacoes: "o".repeat(501) }],
  ];
  for (const [rotulo, over] of acimaDoLimite) {
    await caso(`NVarChar rejeita ${rotulo}`, async (tx, id) => {
      const rej = await rejeitado(() => tx.medicamento.create({ data: base(id, over) }));
      return { pass: rej, detail: rej ? "banco rejeitou" : "banco ACEITOU acima do limite" };
    });
  }

  await caso("@db.Date gravado e relido como o mesmo dia", async (tx, id) => {
    const dias = ["2026-01-01", "2026-10-01", "2026-12-31"];
    const desvios: string[] = [];
    for (const dia of dias) {
      const criado = await tx.medicamento.create({
        data: base(id, { data_inicio: new Date(`${dia}T00:00:00.000Z`), data_fim: new Date(`${dia}T00:00:00.000Z`) }),
      });
      const lido = await tx.medicamento.findUniqueOrThrow({ where: { id: criado.id } });
      if (lido.data_inicio.toISOString().slice(0, 10) !== dia || lido.data_fim?.toISOString().slice(0, 10) !== dia) {
        desvios.push(dia);
      }
    }
    return { pass: desvios.length === 0, detail: desvios.length === 0 ? `${dias.length} datas sem deslocamento` : `${desvios.length} data(s) deslocada(s)` };
  });

  await caso("ativo gravado como bit", async (tx, id) => {
    const m = await tx.medicamento.create({ data: base(id, { ativo: true }) });
    const tipo = await tx.$queryRaw<{ DATA_TYPE: string }[]>`
      SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Medicamento' AND COLUMN_NAME = 'ativo'`;
    const lido = await tx.medicamento.findUniqueOrThrow({ where: { id: m.id } });
    return { pass: tipo[0]?.DATA_TYPE === "bit" && lido.ativo === true, detail: `coluna ${tipo[0]?.DATA_TYPE ?? "(não achada)"}, valor relido true` };
  });

  await caso("FK de idoso_id inexistente é rejeitada", async (tx, id) => {
    const rej = await rejeitado(() => tx.medicamento.create({ data: base(id, { idoso_id: 2147483647 }) }));
    return { pass: rej, detail: rej ? "FK barrou" : "FK NÃO barrou" };
  });

  await caso("FK de criado_por_id inexistente é rejeitada", async (tx, id) => {
    const rej = await rejeitado(() => tx.medicamento.create({ data: base(id, { criado_por_id: 2147483647 }) }));
    return { pass: rej, detail: rej ? "FK barrou" : "FK NÃO barrou" };
  });

  const depois = await prisma.medicamento.count();
  results.push({
    name: "COUNT(*) de Medicamento igual antes e depois",
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
