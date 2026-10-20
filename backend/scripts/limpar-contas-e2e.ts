// Limpeza das contas e2e-*@e2e.elderweb.test do Firebase real (item 6 do checklist de segurança). SÓ RODA À MÃO, fora do CI.
// Nunca imprime e-mail, uid, token nem erro bruto: só contagens e texto fixo. Seleciona SOMENTE e-mail que começa com
// "e2e-" e termina em "@e2e.elderweb.test" (src/lib/limparContasE2e.ts); nenhum outro usuário é tocado.
//
// Uso (dentro de backend/, com as variáveis FIREBASE_* do .env):
//   npx tsx scripts/limpar-contas-e2e.ts                      simulação: só diz quantas seriam apagadas
//   npx tsx scripts/limpar-contas-e2e.ts --confirmo-firebase  apaga (no máximo 500 por execução; repita se passar do teto)

import "dotenv/config";
import { limparContasE2e, MSG_FALHA_FIREBASE, TETO_POR_EXECUCAO } from "../src/lib/limparContasE2e";

async function main() {
  const apagar = process.argv.includes("--confirmo-firebase");

  // Mensagem fixa: não revela quais variáveis faltam nem o valor de nenhuma.
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("Credencial do Firebase Admin não encontrada. Confira o .env do backend. Nada foi feito.");
    process.exitCode = 1;
    return;
  }

  // Import depois da checagem: firebaseAdmin inicializa o SDK no import.
  const { auth } = await import("../src/lib/firebaseAdmin");
  const r = await limparContasE2e(auth, { apagar });

  console.log(`Contas e2e encontradas: ${r.encontradas}`);
  if (r.simulacao) {
    console.log(`Simulação: ${Math.min(r.encontradas, TETO_POR_EXECUCAO)} seriam apagadas nesta execução. Nada foi apagado.`);
    console.log("Para apagar: npx tsx scripts/limpar-contas-e2e.ts --confirmo-firebase");
  } else {
    console.log(`Apagadas: ${r.apagadas}. Falhas: ${r.falhas}.`);
  }
  if (r.limitadoPeloTeto) console.log(`Teto de ${TETO_POR_EXECUCAO} por execução: rode de novo para o restante.`);
}

main().catch((e) => {
  console.error(e instanceof Error && e.message === MSG_FALHA_FIREBASE ? e.message : "Erro inesperado. Nada foi impresso por segurança.");
  process.exitCode = 1;
});
