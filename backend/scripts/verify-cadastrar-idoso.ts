// Verifica contra o banco real o que os testes de POST /usuario/cadastrar-idoso (RF-030,
// item 3.1) só conseguem simular com Prisma mockado:
//   1. o create aninhado Usuario + Vinculo do idoso passa nas CHECKs do banco
//      (firebase_uid NULL com cadastrado_por_id preenchido, vínculo cadastro_familiar);
//   2. e-mail duplicado num create aninhado gera um erro que isDuplicateEmail reconhece
//      (é regex sobre o texto do erro, então o formato real precisa ser conferido);
//   3. a violação não deixa Vinculo pra trás.
// Cada caso roda numa transação sempre revertida (nenhum dado é commitado).
//
// Uso: npx tsx scripts/verify-cadastrar-idoso.ts (dentro de backend/)

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isDuplicateEmail } from "../src/lib/authHelpers";

const prisma = new PrismaClient();

class ForceRollback extends Error {}

const results: { name: string; pass: boolean; detail: string }[] = [];

function dadosIdoso(cadastradoPorId: number, email: string) {
  const agora = new Date();
  return {
    nome: "Idoso de Teste",
    email,
    tipo_perfil: "idoso",
    cadastrado_por_id: cadastradoPorId,
    termo_responsabilidade_aceito_em: agora,
    modo_decisao: "familiar",
    vinculos_como_idoso: {
      create: {
        vinculado_id: cadastradoPorId,
        tipo_vinculo: "familiar",
        origem: "cadastro_familiar",
        status: "pendente",
        data_solicitacao: agora,
      },
    },
  };
}

async function main() {
  // 1. create aninhado válido: banco aceita idoso sem firebase_uid + vínculo pendente.
  try {
    await prisma.$transaction(async (tx) => {
      const familiar = await tx.usuario.create({
        data: {
          firebase_uid: randomUUID(),
          nome: "Familiar de Teste",
          email: `${randomUUID()}@teste.local`,
          tipo_perfil: "familiar",
        },
      });
      const idoso = await tx.usuario.create({
        data: dadosIdoso(familiar.id, `${randomUUID()}@teste.local`),
        include: { vinculos_como_idoso: true },
      });
      const ok =
        idoso.firebase_uid === null &&
        idoso.vinculos_como_idoso.length === 1 &&
        idoso.vinculos_como_idoso[0].status === "pendente";
      results.push({
        name: "create aninhado válido (idoso sem firebase_uid + vínculo)",
        pass: ok,
        detail: ok ? "banco aceitou" : "resultado inesperado",
      });
      throw new ForceRollback();
    });
  } catch (e) {
    if (!(e instanceof ForceRollback)) {
      results.push({
        name: "create aninhado válido (idoso sem firebase_uid + vínculo)",
        pass: false,
        detail: `erro inesperado: ${(e as Error).message}`,
      });
    }
  }

  // 2 e 3. e-mail duplicado: erro reconhecido por isDuplicateEmail e sem Vinculo órfão.
  try {
    await prisma.$transaction(async (tx) => {
      const familiar = await tx.usuario.create({
        data: {
          firebase_uid: randomUUID(),
          nome: "Familiar de Teste",
          email: `${randomUUID()}@teste.local`,
          tipo_perfil: "familiar",
        },
      });
      const email = `${randomUUID()}@teste.local`;
      await tx.usuario.create({ data: dadosIdoso(familiar.id, email) });

      let erro: unknown = null;
      try {
        await tx.usuario.create({ data: dadosIdoso(familiar.id, email) });
      } catch (e) {
        erro = e;
      }
      results.push({
        name: "e-mail duplicado é reconhecido por isDuplicateEmail",
        pass: erro !== null && isDuplicateEmail(erro),
        detail:
          erro === null
            ? "segundo create foi aceito (índice não barrou)"
            : `mensagem real: ${(erro as Error).message.replace(/\s+/g, " ").slice(0, 200)}`,
      });

      const vinculos = await tx.vinculo.count({ where: { vinculado_id: familiar.id } });
      results.push({
        name: "duplicado não deixa Vinculo órfão",
        pass: vinculos === 1,
        detail: `vínculos do familiar dentro da transação: ${vinculos} (esperado 1, o do primeiro idoso)`,
      });
      throw new ForceRollback();
    });
  } catch (e) {
    if (!(e instanceof ForceRollback)) {
      results.push({
        name: "e-mail duplicado (falha no próprio script)",
        pass: false,
        detail: `erro inesperado: ${(e as Error).message}`,
      });
    }
  }

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
    console.error("Erro fatal no script de verificação:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
