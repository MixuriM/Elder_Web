import { PrismaClient, Prisma } from "@prisma/client";

const basePrisma = new PrismaClient();

// Azure SQL Database fica ocioso depois de um tempo sem tráfego e demora alguns
// segundos pra aceitar conexão de novo (visto nos logs do Render: 3 tentativas
// seguidas de "Can't reach database server" antes de emplacar) — isso acontece
// mesmo com o backend do Render já de pé e respondendo, então não tem relação
// com o cold start do Render em si. Sem retry aqui, a primeira query de cada
// instância depois de um tempo ocioso estoura 500 pro usuário.
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 8000, 8000];

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      for (let tentativa = 0; ; tentativa++) {
        try {
          return await query(args);
        } catch (err) {
          const podeTentarDeNovo =
            err instanceof Prisma.PrismaClientInitializationError &&
            tentativa < RETRY_DELAYS_MS.length;
          if (!podeTentarDeNovo) throw err;
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[tentativa]));
        }
      }
    },
  },
});
