// Modo demonstração (D5): grava ou remove as seis contas FICTÍCIAS do elenco e os dados delas. Escreve no banco E no
// Firebase real (cria as contas sem senha), por isso roda só à mão, pelo Marcos. Nunca imprime DATABASE_URL, host,
// usuário, senha, token nem e-mail: só contagens e texto fixo por tipo de falha.
//
// Uso (dentro de backend/):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=${MSSQL_SA_PASSWORD};trustServerCertificate=true" \
//     npx tsx scripts/semear-demo.ts              (semeia ou restaura, banco local)
//   ... npx tsx scripts/semear-demo.ts --remover  (apaga tudo do elenco, banco e Firebase)
//   npx tsx scripts/semear-demo.ts --confirmo-azure [--remover]   (banco não local: só com autorização do Marcos)
// O .env aponta para o Azure: sem DATABASE_URL local no comando e sem --confirmo-azure, o script recusa.

import "dotenv/config";

const HOSTS_LOCAIS = ["localhost", "127.0.0.1"];

// Texto fixo por tipo de falha: o erro bruto do Prisma ou do Firebase pode citar host, e-mail ou query.
function descreverFalha(e: unknown): string {
  const info = (e ?? {}) as { name?: unknown; code?: unknown; errorCode?: unknown };
  const classe = typeof info.name === "string" && /^[A-Za-z]+$/.test(info.name) ? info.name : "erro";
  const codigo = info.errorCode ?? info.code;
  return typeof codigo === "string" && /^[A-Za-z0-9/_-]{1,40}$/.test(codigo) ? `${classe} ${codigo}` : classe;
}

async function main() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  const local = HOSTS_LOCAIS.includes(host);
  if (!local && !process.argv.includes("--confirmo-azure")) {
    console.log("Nada feito: o banco não é local. Banco não local exige --confirmo-azure (autorização explícita do Marcos).");
    process.exitCode = 1;
    return;
  }
  const remover = process.argv.includes("--remover");
  console.log(`Banco: ${local ? "local" : "não local"}. Modo: ${remover ? "remover" : "semear"}.`);

  // Imports só depois da trava: carregar o Firebase Admin e o Prisma não deve acontecer se o script vai recusar.
  const { PrismaClient } = await import("@prisma/client");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { ErroSemente, removerDemo, semearDemo } = await import("../src/lib/demo/semear");
  const prisma = new PrismaClient({ log: [] });
  try {
    const contagens = remover ? await removerDemo({ prisma, auth }) : await semearDemo({ prisma, auth, agora: new Date() });
    console.log(remover ? "Removido:" : "Gravado:");
    for (const [tabela, n] of Object.entries(contagens)) console.log(`  ${tabela.padEnd(14)}${n}`);
  } catch (e) {
    // Mensagem fixa da semente (usuário estranho ocupando e-mail reservado): nada foi apagado nem gravado.
    if (e instanceof ErroSemente) {
      console.error(e.message);
      process.exitCode = 2;
      return;
    }
    // O Firebase roda antes da transação do banco, e a transação volta inteira se falhar. Rodar de novo é seguro.
    console.error(`Falhou (${descreverFalha(e)}). Rode de novo: a semente é idempotente.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
