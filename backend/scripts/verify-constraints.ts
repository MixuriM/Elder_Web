// Verifica que as constraints manuais adicionadas à mão nas migrations (índices únicos
// filtrados + CHECKs — @@unique do Prisma não aceita WHERE, sqlserver não suporta enum)
// estão realmente ativas no banco, não só presentes no arquivo SQL. Cobre as 10 da
// migration 20260831005102_init_schema e as adicionadas depois. Cada teste roda dentro
// de uma transação sempre revertida no final (nenhum dado de teste é commitado).
//
// Uso: npx tsx scripts/verify-constraints.ts

import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];

class ForceRollback extends Error {}

function isConstraintViolation(e: unknown): boolean {
  // SQL Server raises the CHECK/UNIQUE violation as a raw DB error surfaced by
  // Prisma as P2010 (raw query failed) or, for typed Client calls, P2003/P2002/unknown —
  // in practice the sqlserver connector bubbles these up as generic Prisma errors
  // wrapping the driver's "The INSERT statement conflicted with the CHECK constraint"
  // or "Cannot insert duplicate key row" messages. Match on that text rather than a
  // fixed Prisma error code, since both typed and raw paths land here differently.
  // Prisma's mssql connector also mislabels typed-Client CHECK violations as P2003
  // ("Foreign key constraint violated: `<constraint name> (index)`"), naming the actual
  // CHECK constraint — this script never triggers a real FK violation (all rejection
  // cases use valid FK references), so matching that message here is safe.
  if (e instanceof Error) {
    return /CHECK constraint|UNIQUE constraint|duplicate key|Violation of|Foreign key constraint violated/i.test(
      e.message,
    );
  }
  return false;
}

// expectedConstraint (opcional): o erro do banco precisa citar esse nome — sem isso, uma
// rejeição por outro motivo (ex.: FK inválida) passaria como se a constraint funcionasse.
async function runExpectingRejection(
  name: string,
  attempt: (tx: Prisma.TransactionClient) => Promise<void>,
  expectedConstraint?: string,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await attempt(tx);
      // Chegou aqui sem erro = o banco aceitou dado inválido. Força rollback mesmo
      // assim (nunca commitar) e sinaliza falha via exceção controlada.
      throw new ForceRollback("insert inválido foi aceito pelo banco");
    });
    results.push({ name, pass: false, detail: "FAIL: insert inválido foi aceito pelo banco" });
  } catch (e) {
    if (e instanceof ForceRollback) {
      results.push({ name, pass: false, detail: `FAIL: ${e.message}` });
    } else if (expectedConstraint && !(e as Error).message.includes(expectedConstraint)) {
      results.push({
        name,
        pass: false,
        detail: `FAIL: erro não cita ${expectedConstraint}: ${(e as Error).message}`,
      });
    } else if (isConstraintViolation(e)) {
      results.push({ name, pass: true, detail: "PASS: banco rejeitou o insert inválido" });
    } else {
      results.push({
        name,
        pass: false,
        detail: `FAIL: erro inesperado (não é violação de constraint): ${(e as Error).message}`,
      });
    }
  }
}

async function runExpectingSuccess(
  name: string,
  attempt: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await attempt(tx);
      // Sucesso esperado — força rollback pra não deixar dado de teste no banco.
      throw new ForceRollback("__ok__");
    });
  } catch (e) {
    if (e instanceof ForceRollback && e.message === "__ok__") {
      results.push({ name, pass: true, detail: "PASS: banco aceitou o insert válido (esperado)" });
      return;
    }
    results.push({
      name,
      pass: false,
      detail: `FAIL: insert válido foi rejeitado: ${(e as Error).message}`,
    });
  }
}

function baseUsuario(overrides: Partial<Prisma.UsuarioUncheckedCreateInput> = {}): Prisma.UsuarioUncheckedCreateInput {
  return {
    firebase_uid: randomUUID(),
    nome: "Usuário de Teste",
    email: `${randomUUID()}@teste.local`,
    tipo_perfil: "idoso",
    ...overrides,
  };
}

async function main() {
  // 1. Usuario_email_key — duplicata de email não-nulo deve ser rejeitada.
  await runExpectingRejection("Usuario_email_key (duplicata de email)", async (tx) => {
    const email = `${randomUUID()}@teste.local`;
    await tx.usuario.create({ data: baseUsuario({ email }) });
    await tx.usuario.create({ data: baseUsuario({ email }) });
  });

  // 1b. Usuario_email_key — dois emails NULL lado a lado devem ser permitidos (índice filtrado).
  await runExpectingSuccess("Usuario_email_key (dois NULLs permitidos)", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ email: null, telefone: "11999990001" }) });
    await tx.usuario.create({ data: baseUsuario({ email: null, telefone: "11999990002" }) });
  });

  // 1c. Usuario_firebase_uid_key — duplicata de firebase_uid não-nulo deve ser rejeitada.
  await runExpectingRejection("Usuario_firebase_uid_key (duplicata de firebase_uid)", async (tx) => {
    const firebase_uid = randomUUID();
    await tx.usuario.create({ data: baseUsuario({ firebase_uid }) });
    await tx.usuario.create({
      data: baseUsuario({ firebase_uid, email: `${randomUUID()}@teste.local` }),
    });
  });

  // 1d. Usuario_firebase_uid_key — dois firebase_uid NULL lado a lado devem ser permitidos
  // (índice filtrado), desde que cadastrado_por_id esteja preenchido (RF-030).
  await runExpectingSuccess(
    "Usuario_firebase_uid_key (dois NULLs permitidos, cadastrado por familiar)",
    async (tx) => {
      const familiar = await tx.usuario.create({ data: baseUsuario({ tipo_perfil: "familiar" }) });
      await tx.usuario.create({
        data: baseUsuario({
          firebase_uid: null,
          email: `${randomUUID()}@teste.local`,
          cadastrado_por_id: familiar.id,
        }),
      });
      await tx.usuario.create({
        data: baseUsuario({
          firebase_uid: null,
          email: `${randomUUID()}@teste.local`,
          cadastrado_por_id: familiar.id,
        }),
      });
    },
  );

  // 1e. CK_Usuario_firebase_uid_cadastrado_por — firebase_uid NULL sem cadastrado_por_id deve
  // ser rejeitado (autocadastro sempre passa por /auth/sync com token Firebase).
  await runExpectingRejection("CK_Usuario_firebase_uid_cadastrado_por", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ firebase_uid: null }) });
  });

  // 2. CK_Usuario_email_telefone
  await runExpectingRejection("CK_Usuario_email_telefone", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ email: null, telefone: null }) });
  });

  // 3. CK_Usuario_tipo_perfil
  await runExpectingRejection("CK_Usuario_tipo_perfil", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ tipo_perfil: "invalido" }) });
  });

  // 4. CK_Evento_tipo_evento
  await runExpectingRejection("CK_Evento_tipo_evento", async (tx) => {
    const idoso = await tx.usuario.create({ data: baseUsuario() });
    await tx.evento.create({
      data: {
        idoso_id: idoso.id,
        criado_por_id: idoso.id,
        tipo_evento: "invalido",
        titulo: "Evento de teste",
        data_hora_inicio: new Date(),
      },
    });
  });

  // 5-7. CHECKs de Vinculo (tipo_vinculo, origem, status). Cada um: FKs válidas (Usuario
  // criados na própria transação), controle positivo (mesmo insert com valor válido é
  // aceito) e rejeição do valor inválido citando o nome da constraint.
  const vinculoValido = {
    tipo_vinculo: "cuidador",
    origem: "solicitacao_cuidador",
    status: "pendente",
  };
  async function novoVinculoBase(tx: Prisma.TransactionClient) {
    const idoso = await tx.usuario.create({ data: baseUsuario() });
    const outro = await tx.usuario.create({ data: baseUsuario({ tipo_perfil: "cuidador" }) });
    return { idoso_id: idoso.id, vinculado_id: outro.id, data_solicitacao: new Date() };
  }
  for (const [n, constraint, campo] of [
    [5, "CK_Vinculo_tipo_vinculo", "tipo_vinculo"],
    [6, "CK_Vinculo_origem", "origem"],
    [7, "CK_Vinculo_status", "status"],
  ] as const) {
    await runExpectingSuccess(`${constraint} (controle positivo, caso ${n})`, async (tx) => {
      await tx.vinculo.create({ data: { ...(await novoVinculoBase(tx)), ...vinculoValido } });
    });
    await runExpectingRejection(
      constraint,
      async (tx) => {
        await tx.vinculo.create({
          data: { ...(await novoVinculoBase(tx)), ...vinculoValido, [campo]: "invalido" },
        });
      },
      constraint,
    );
  }

  // 8. CK_Usuario_modo_decisao
  await runExpectingRejection("CK_Usuario_modo_decisao", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ modo_decisao: "invalido" }) });
  });

  // 9. CK_Usuario_modo_decisao_solicitado
  await runExpectingRejection("CK_Usuario_modo_decisao_solicitado", async (tx) => {
    await tx.usuario.create({ data: baseUsuario({ modo_decisao_solicitado: "invalido" }) });
  });

  // 10. CK_RegistroDoseMedicamento_status_administracao
  await runExpectingRejection("CK_RegistroDoseMedicamento_status_administracao", async (tx) => {
    const idoso = await tx.usuario.create({ data: baseUsuario() });
    const medicamento = await tx.medicamento.create({
      data: {
        idoso_id: idoso.id,
        criado_por_id: idoso.id,
        nome: "Remédio de teste",
        dosagem: "10mg",
        frequencia: "1x ao dia",
        data_inicio: new Date(),
        ativo: true,
      },
    });
    await tx.registroDoseMedicamento.create({
      data: {
        medicamento_id: medicamento.id,
        registrado_por_id: idoso.id,
        data_hora_administracao: new Date(),
        status_administracao: "invalido",
      },
    });
  });

  // 11. CK_Usuario_email_convite_familiar_tipo_perfil (RF-024, migration
  // 20260916090000_add_check_email_convite_familiar_idoso) — email_convite_familiar
  // só pode ser não-nulo quando tipo_perfil='idoso'.
  await runExpectingRejection("CK_Usuario_email_convite_familiar_tipo_perfil", async (tx) => {
    await tx.usuario.create({
      data: baseUsuario({ tipo_perfil: "cuidador", email_convite_familiar: "familiar@teste.local" }),
    });
  });

  // 12. CK_Usuario_modo_decisao_solicitado_conjunto (RF-033, migration
  // 20260918100000_add_check_modo_decisao_solicitado_conjunto) — modo_decisao_solicitado
  // preenchido sem os campos irmãos (solicitado_por_id/em, expira_em) deve ser rejeitado.
  await runExpectingRejection("CK_Usuario_modo_decisao_solicitado_conjunto", async (tx) => {
    await tx.usuario.create({
      data: baseUsuario({ modo_decisao_solicitado: "familiar" }),
    });
  });

  // 13. CK_Usuario_termo_cadastrado_por (RF-030, migration
  // 20260921090000_add_check_termo_cadastrado_por) — termo_responsabilidade_aceito_em
  // preenchido sem cadastrado_por_id deve ser rejeitado.
  await runExpectingRejection("CK_Usuario_termo_cadastrado_por", async (tx) => {
    await tx.usuario.create({
      data: baseUsuario({ termo_responsabilidade_aceito_em: new Date() }),
    });
  });

  // 14. Vinculo_idoso_id_vinculado_id_tipo_vinculo_key (item 2.3, migration
  // 20260915090000_vinculo_unique_ativo) — índice único filtrado WHERE status IN
  // ('pendente','aprovado'): mesmo par/tipo com dois vínculos ativos deve ser rejeitado.
  await runExpectingRejection("Vinculo_idoso_id_vinculado_id_tipo_vinculo_key (duplicata ativa)", async (tx) => {
    const idoso = await tx.usuario.create({ data: baseUsuario() });
    const familiar = await tx.usuario.create({ data: baseUsuario({ tipo_perfil: "familiar" }) });
    const vinculo = {
      idoso_id: idoso.id,
      vinculado_id: familiar.id,
      tipo_vinculo: "familiar",
      origem: "solicitacao_familiar",
      data_solicitacao: new Date(),
    };
    await tx.vinculo.create({ data: { ...vinculo, status: "pendente" } });
    await tx.vinculo.create({ data: { ...vinculo, status: "aprovado" } });
  }, "Vinculo_idoso_id_vinculado_id_tipo_vinculo_key");

  // 14b. Mesmo índice, lado filtrado: vínculos 'recusado' não contam (nova solicitação depois
  // de recusar/contestar é permitida, e pode haver vários 'recusado' do mesmo par), e um
  // 'recusado' convive com um ativo.
  await runExpectingSuccess(
    "Vinculo_idoso_id_vinculado_id_tipo_vinculo_key ('recusado' fora do índice)",
    async (tx) => {
      const idoso = await tx.usuario.create({ data: baseUsuario() });
      const familiar = await tx.usuario.create({ data: baseUsuario({ tipo_perfil: "familiar" }) });
      const vinculo = {
        idoso_id: idoso.id,
        vinculado_id: familiar.id,
        tipo_vinculo: "familiar",
        origem: "solicitacao_familiar",
        data_solicitacao: new Date(),
      };
      await tx.vinculo.create({ data: { ...vinculo, status: "recusado" } });
      await tx.vinculo.create({ data: { ...vinculo, status: "recusado" } });
      await tx.vinculo.create({ data: { ...vinculo, status: "pendente" } });
    },
  );

  console.log("\nConstraint".padEnd(52) + "Resultado");
  console.log("-".repeat(70));
  for (const r of results) {
    console.log(r.name.padEnd(52) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail.replace(/^(PASS|FAIL): /, ""));
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\n" + `${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    console.error(`\n${failed.length} constraint(s) NÃO estão ativas de verdade no banco.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Erro fatal no script de verificação:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
