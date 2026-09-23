// Suporte pro e2e do item 3.3 (frontend/e2e/idoso-assume-conta.spec.ts): confirma que
// existe exatamente 1 Usuario com o e-mail informado e que firebase_uid está
// preenchido — a prova de que o anexo aconteceu e não duplicou a linha.
//
// Uso: npx tsx scripts/e2e-verificar-usuario-unico.ts <email>

import { prisma } from "../src/lib/prisma";

const email = process.argv[2];
if (!email) {
  console.error("Uso: npx tsx scripts/e2e-verificar-usuario-unico.ts <email>");
  process.exit(1);
}

prisma.usuario
  .findMany({ where: { email }, select: { id: true, firebase_uid: true } })
  .then((linhas) => {
    if (linhas.length !== 1) {
      console.error(`FALHA: esperava 1 Usuario com esse e-mail, achou ${linhas.length}`);
      process.exit(1);
    }
    if (!linhas[0].firebase_uid) {
      console.error("FALHA: firebase_uid não anexado");
      process.exit(1);
    }
    console.log(`OK: 1 Usuario (id ${linhas[0].id}), firebase_uid anexado`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("ERRO:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
