// Smoke test das funções puras de POST /auth/sync (backend/src/routes/auth.ts).
// Não toca no Firebase nem no banco — só valida os branches de decisão da rota.
//
// Uso: npx tsx scripts/verify-auth-sync.ts

import "dotenv/config";
import assert from "node:assert/strict";
import { isTipoPerfil, isDuplicateFirebaseUid } from "../src/routes/auth";

assert.equal(isTipoPerfil("idoso"), true);
assert.equal(isTipoPerfil("cuidador"), true);
assert.equal(isTipoPerfil("familiar"), true);
assert.equal(isTipoPerfil("invalido"), false);
assert.equal(isTipoPerfil(undefined), false);
assert.equal(isTipoPerfil(123), false);

assert.equal(isDuplicateFirebaseUid(new Error("Violation of UNIQUE KEY constraint")), true);
assert.equal(isDuplicateFirebaseUid(new Error("Cannot insert duplicate key row")), true);
assert.equal(isDuplicateFirebaseUid(new Error("some other db error")), false);
assert.equal(isDuplicateFirebaseUid("not an error"), false);

console.log("PASS: helpers de /auth/sync");
