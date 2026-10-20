// Suporte pro e2e da exclusão de conta (frontend/e2e/exclusao-conta.spec.ts): lê o id da conta de teste antes e
// confere no SQL local, depois, que a linha ficou anonimizada. Só roda contra o banco local e só com e-mail do e2e.
//
// Uso:
//   npx tsx scripts/e2e-conta-excluida.ts antes  <email>       imprime "ID <n>"
//   npx tsx scripts/e2e-conta-excluida.ts depois <id> <email>  imprime "OK: ..." ou sai com 1

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("FALHA: DATABASE_URL não aponta para o banco local. Abortado.");
  process.exit(1);
}

const [modo, a, b] = process.argv.slice(2);
const email = modo === "antes" ? a : b;
if (!email || !/^e2e-[a-z0-9-]+@e2e\.elderweb\.test$/.test(email) || (modo !== "antes" && modo !== "depois")) {
  console.error("Uso: tsx scripts/e2e-conta-excluida.ts antes <email> | depois <id> <email> (e-mail e2e-*@e2e.elderweb.test)");
  process.exit(1);
}

async function main() {
  if (modo === "antes") {
    const u = await prisma.usuario.findFirst({ where: { email }, select: { id: true } });
    if (!u) throw new Error("conta de teste não encontrada");
    console.log(`ID ${u.id}`);
    return;
  }
  const id = Number(a);
  if (!Number.isInteger(id)) throw new Error("id inválido");
  const sobrou = await prisma.usuario.count({ where: { email } });
  const u = await prisma.usuario.findUnique({ where: { id } });
  const falhas: string[] = [];
  if (sobrou !== 0) falhas.push("o e-mail original ainda existe");
  if (!u) falhas.push("a linha sumiu (deveria ficar anonimizada)");
  else {
    if (u.nome !== "Conta excluída") falhas.push("nome não anonimizado");
    if (u.email !== `excluido-${id}@excluido.invalid`) falhas.push("e-mail não anonimizado");
    if (u.telefone !== null || u.foto_perfil !== null || u.email_convite_familiar !== null) falhas.push("telefone, foto ou convite ficaram");
    if (u.aceite_documentos_versao === null) falhas.push("a prova de aceite não deveria sumir");
  }
  if (falhas.length > 0) throw new Error(falhas.join("; "));
  console.log(`OK: linha ${id} anonimizada, e-mail original ausente, prova de aceite preservada`);
}

main()
  .catch((e) => {
    console.error("FALHA:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
