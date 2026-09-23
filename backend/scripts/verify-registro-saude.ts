// Verifica contra o banco real o que os testes de POST /saude (RF-007, item 4.1) só
// conseguem simular com Prisma mockado:
//   1. create válido com valor_2 nulo e com valor_2 é aceito;
//   2. decimal(6,2) aceita 9999.99 e o banco rejeita 10000.00;
//   3. FK de registrado_por_id inexistente é rejeitada;
//   4. data_hora é gravada e relida sem deslocamento;
//   5. COUNT(*) de RegistroSaude é igual antes e depois.
// Cada caso roda numa transação sempre revertida (nenhum dado é commitado). Não loga
// valores de saúde: só PASS/FAIL e o que o caso verificou.
//
// Uso: npx tsx scripts/verify-registro-saude.ts (dentro de backend/, contra banco LOCAL)

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

function base(idosoId: number, over: Partial<Prisma.RegistroSaudeUncheckedCreateInput> = {}) {
  return {
    idoso_id: idosoId,
    registrado_por_id: idosoId,
    editado_por_id: idosoId,
    tipo_medicao: "peso",
    valor_1: "70.50",
    unidade: "kg",
    data_hora: new Date(),
    ...over,
  };
}

// Devolve o erro lançado por fn, ou null se aceitou. Nunca inclui a mensagem no detalhe.
async function rejeitado(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const antes = await prisma.registroSaude.count();

  await caso("create válido com valor_2 nulo", async (tx, id) => {
    const r = await tx.registroSaude.create({ data: base(id) });
    return { pass: r.valor_2 === null && r.editado_por_id === id, detail: "valor_2 nulo aceito, editado_por_id preenchido" };
  });

  await caso("create válido com valor_2", async (tx, id) => {
    const r = await tx.registroSaude.create({ data: base(id, { tipo_medicao: "pressao", valor_1: "120", valor_2: "80", unidade: "mmHg" }) });
    return { pass: Number(r.valor_2) === 80, detail: "valor_2 gravado e relido" };
  });

  await caso("decimal(6,2) aceita 9999.99", async (tx, id) => {
    const r = await tx.registroSaude.create({ data: base(id, { valor_1: "9999.99" }) });
    return { pass: Number(r.valor_1) === 9999.99, detail: "limite aceito" };
  });

  await caso("decimal(6,2) rejeita 10000.00", async (tx, id) => {
    const rej = await rejeitado(() => tx.registroSaude.create({ data: base(id, { valor_1: "10000.00" }) }));
    return { pass: rej, detail: rej ? "banco rejeitou" : "banco ACEITOU acima do limite" };
  });

  await caso("FK de registrado_por_id inexistente é rejeitada", async (tx, id) => {
    const rej = await rejeitado(() => tx.registroSaude.create({ data: base(id, { registrado_por_id: 2147483647 }) }));
    return { pass: rej, detail: rej ? "FK barrou" : "FK NÃO barrou" };
  });

  await caso("data_hora gravada e relida sem deslocamento", async (tx, id) => {
    const enviado = new Date("2026-09-23T14:30:15.123Z");
    const criado = await tx.registroSaude.create({ data: base(id, { data_hora: enviado }) });
    const lido = await tx.registroSaude.findUniqueOrThrow({ where: { id: criado.id } });
    const pass = lido.data_hora.getTime() === enviado.getTime();
    return { pass, detail: pass ? "instante idêntico (UTC)" : `deslocamento de ${lido.data_hora.getTime() - enviado.getTime()} ms` };
  });

  const depois = await prisma.registroSaude.count();
  results.push({
    name: "COUNT(*) de RegistroSaude igual antes e depois",
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
