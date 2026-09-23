// Suporte pro e2e do item 3.3 (frontend/e2e/idoso-assume-conta.spec.ts): marca
// emailVerified=true no Firebase Auth via Admin SDK, simulando o clique no link de
// confirmação sem depender de caixa de e-mail real. Nunca roda contra produção — só
// existe pra ser chamado pelo Playwright, sempre contra o projeto Firebase de
// desenvolvimento já usado pelos e2e existentes.
//
// Uso: npx tsx scripts/e2e-marcar-email-verificado.ts <email>

import "dotenv/config";
import { auth } from "../src/lib/firebaseAdmin";

const email = process.argv[2];
if (!email) {
  console.error("Uso: npx tsx scripts/e2e-marcar-email-verificado.ts <email>");
  process.exit(1);
}

auth
  .getUserByEmail(email)
  .then((usuario) => auth.updateUser(usuario.uid, { emailVerified: true }))
  .then(() => {
    console.log(`OK: ${email} marcado como emailVerified=true`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("ERRO:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
