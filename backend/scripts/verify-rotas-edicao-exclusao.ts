// Verificação ponta a ponta da Fase 11 (11.1): excluir registro de saúde (DELETE /saude), editar e excluir medicamento
// (PATCH e DELETE /remedios), incluindo que excluir um medicamento apaga as doses dele na mesma transação. Rota REAL
// (app de ./app via Supertest), Prisma REAL e SQL Server LOCAL. Os testes de Jest mockam o Prisma; este script exercita o
// caminho inteiro junto, inclusive as FKs de RegistroDoseMedicamento e o filtro por idoso_id feito pelo próprio banco.
// Editar e excluir refeição ficam em verify-rotas-alimentacao.ts.
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken passa a devolver { uid: <token> }, então o "token"
// enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e nenhuma chamada de rede ao Firebase
// acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida. Todo dado criado (contas,
// vínculos, registros, medicamentos, doses) é rastreado e apagado no finally; o COUNT(*) de RegistroSaude, Medicamento,
// RegistroDoseMedicamento, Usuario e Vinculo é conferido antes e depois. O prefixo `verify-edex-` no firebase_uid marca
// conta residual se o processo for morto no meio. Os valores levam uma sentinela única: o script confere 0 ocorrência
// dela em stdout e stderr (o próprio relatório não imprime valores de registro).
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=...;encrypt=true;trustServerCertificate=true" npx tsx scripts/verify-rotas-edicao-exclusao.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomUUID } from "node:crypto";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const ok = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

async function main() {
  exigirBancoLocal();
  // Imports depois da trava: carregar ./app já cria o PrismaClient e o app do Firebase Admin.
  const { default: request } = await import("supertest");
  // app primeiro: ele carrega o dotenv, de que firebaseAdmin depende ao inicializar.
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({
    uid: t,
    email_verified: true,
  });

  const tag = randomUUID().slice(0, 8);
  const sentinela = `sentinela-edex-${randomUUID()}`;
  const usuarios: number[] = [];

  // Captura stdout/stderr do processo inteiro (inclui o errorHandler e o Prisma) para conferir a sentinela.
  const capturado: string[] = [];
  const outOriginal = process.stdout.write.bind(process.stdout);
  const errOriginal = process.stderr.write.bind(process.stderr);
  const espiar = (original: typeof process.stdout.write) =>
    ((chunk: unknown, ...resto: unknown[]) => {
      capturado.push(String(chunk));
      return (original as (...a: unknown[]) => boolean)(chunk, ...resto);
    }) as typeof process.stdout.write;
  process.stdout.write = espiar(outOriginal);
  process.stderr.write = espiar(errOriginal);

  async function conta(perfil: "idoso" | "cuidador" | "familiar", modo: "idoso" | "familiar" | null = null) {
    const uid = `verify-edex-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: modo },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid };
  }

  async function vincular(
    idosoId: number,
    vinculadoId: number,
    tipo: "cuidador" | "familiar",
    flags = false,
    status: "aprovado" | "pendente" = "aprovado",
  ) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status,
        aprovador_id: status === "pendente" ? null : idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: flags,
        permite_registrar_saude: flags,
        permite_criar_evento_cuidado: flags,
      },
    });
  }

  const semearSaude = async (idosoId: number, autorId: number) =>
    (
      await prisma.registroSaude.create({
        data: {
          idoso_id: idosoId,
          registrado_por_id: autorId,
          editado_por_id: autorId,
          tipo_medicao: "pressao",
          valor_1: 120,
          valor_2: 80,
          unidade: "mmHg",
          data_hora: new Date("2026-10-10T12:00:00.000Z"),
          observacoes: `${sentinela}-saude`,
        },
        select: { id: true },
      })
    ).id;

  const semearMed = async (idosoId: number, doses = 0) => {
    const m = await prisma.medicamento.create({
      data: {
        idoso_id: idosoId,
        criado_por_id: idosoId,
        editado_por_id: null,
        nome: `${sentinela}-nome`,
        dosagem: "10 mg",
        frequencia: "2x ao dia",
        data_inicio: new Date("2026-10-01T00:00:00.000Z"),
        data_fim: new Date("2026-10-31T00:00:00.000Z"),
        observacoes: `${sentinela}-obs`,
        ativo: true,
      },
      select: { id: true },
    });
    for (let i = 0; i < doses; i++) {
      await prisma.registroDoseMedicamento.create({
        data: { medicamento_id: m.id, registrado_por_id: idosoId, status_administracao: "administrado", data_hora_administracao: new Date("2026-10-10T12:00:00.000Z") },
      });
    }
    return m.id;
  };

  const existeSaude = async (id: number) => (await prisma.registroSaude.count({ where: { id } })) === 1;
  const existeMed = async (id: number) => (await prisma.medicamento.count({ where: { id } })) === 1;
  const dosesDe = (medId: number) => prisma.registroDoseMedicamento.count({ where: { medicamento_id: medId } });
  const contagens = async () => ({
    saude: await prisma.registroSaude.count(),
    med: await prisma.medicamento.count(),
    dose: await prisma.registroDoseMedicamento.count(),
    usuario: await prisma.usuario.count(),
    vinculo: await prisma.vinculo.count(),
  });

  const del = (token: string, caminho: string) => request(app).delete(caminho).set("Authorization", `Bearer ${token}`);
  const patch = (token: string, caminho: string, corpo: object) =>
    request(app).patch(caminho).set("Authorization", `Bearer ${token}`).send(corpo);

  const antes = await contagens();
  try {
    const idoso = await conta("idoso");
    const outroIdoso = await conta("idoso");
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    const familiarPend = await conta("familiar");
    await vincular(idoso.id, cuidador.id, "cuidador", true);
    await vincular(idoso.id, familiar.id, "familiar");
    await vincular(idoso.id, familiarPend.id, "familiar", false, "pendente");

    // ---------------------------------------------------------------- saúde: DELETE
    const s1 = await semearSaude(idoso.id, idoso.id);
    const r1 = await del(idoso.token, `/saude/${s1}`);
    ok("saúde: idoso exclui o próprio registro: 204 e a linha some", r1.status === 204 && r1.text === "" && !(await existeSaude(s1)), `status ${r1.status}`);
    const r1b = await del(idoso.token, `/saude/${s1}`);
    ok("saúde: segundo DELETE: 404", r1b.status === 404, `status ${r1b.status}`);

    const sOutro = await semearSaude(outroIdoso.id, outroIdoso.id);
    const r2 = await del(idoso.token, `/saude/${sOutro}`);
    const r2b = await del(idoso.token, `/saude/2147483647`);
    ok(
      "saúde: registro de outro idoso = 404 igual ao inexistente, e a linha permanece",
      r2.status === 404 && r2b.status === 404 && JSON.stringify(r2.body) === JSON.stringify(r2b.body) && (await existeSaude(sOutro)),
      `status ${r2.status} e ${r2b.status}`,
    );

    const sCuid = await semearSaude(idoso.id, cuidador.id);
    const sDoIdoso = await semearSaude(idoso.id, idoso.id);
    const r3 = await del(cuidador.token, `/saude/idoso/${idoso.id}/${sDoIdoso}`);
    ok("saúde: cuidador com flag exclui registro de outro autor: 403 e a linha permanece", r3.status === 403 && (await existeSaude(sDoIdoso)), `status ${r3.status}`);
    const r4 = await del(cuidador.token, `/saude/idoso/${idoso.id}/${sCuid}`);
    ok("saúde: cuidador com flag exclui o registro que ele criou: 204 e a linha some", r4.status === 204 && !(await existeSaude(sCuid)), `status ${r4.status}`);
    const sCuid2 = await semearSaude(idoso.id, cuidador.id);
    await prisma.vinculo.updateMany({ where: { idoso_id: idoso.id, vinculado_id: cuidador.id }, data: { permite_registrar_saude: false } });
    const r5 = await del(cuidador.token, `/saude/idoso/${idoso.id}/${sCuid2}`);
    ok("saúde: cuidador sem a flag: 403 e a linha permanece", r5.status === 403 && (await existeSaude(sCuid2)), `status ${r5.status}`);
    await prisma.vinculo.updateMany({ where: { idoso_id: idoso.id, vinculado_id: cuidador.id }, data: { permite_registrar_saude: true } });

    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const r6 = await del(familiar.token, `/saude/idoso/${idoso.id}/${sDoIdoso}`);
    ok("saúde: familiar com modo_decisao 'idoso': 403 e a linha permanece", r6.status === 403 && (await existeSaude(sDoIdoso)), `status ${r6.status}`);
    const r6b = await del(familiarPend.token, `/saude/idoso/${idoso.id}/${sDoIdoso}`);
    ok("saúde: familiar com vínculo pendente: 403 e a linha permanece", r6b.status === 403 && (await existeSaude(sDoIdoso)), `status ${r6b.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const r7 = await del(familiar.token, `/saude/idoso/${idoso.id}/${sDoIdoso}`);
    ok("saúde: familiar com modo_decisao 'familiar': 204 e a linha some", r7.status === 204 && !(await existeSaude(sDoIdoso)), `status ${r7.status}`);
    const r7b = await del(familiar.token, `/saude/idoso/${outroIdoso.id}/${sOutro}`);
    ok("saúde: familiar de A pedindo o idoso B: 403 e a linha de B permanece", r7b.status === 403 && (await existeSaude(sOutro)), `status ${r7b.status}`);

    // ---------------------------------------------------------------- medicamento: PATCH
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const m1 = await semearMed(idoso.id, 2);
    const p1 = await patch(idoso.token, `/remedios/${m1}`, { dosagem: "20 mg", data_fim: null, ativo: false, idoso_id: outroIdoso.id });
    const l1 = await prisma.medicamento.findUnique({ where: { id: m1 } });
    ok(
      "medicamento: idoso edita: 200, linha mudou, data_fim limpa, editado_por_id do idoso; ativo e idoso_id do corpo ignorados",
      p1.status === 200 &&
        l1?.dosagem === "20 mg" &&
        l1.data_fim === null &&
        l1.editado_por_id === idoso.id &&
        l1.ativo === true &&
        l1.idoso_id === idoso.id &&
        l1.nome === `${sentinela}-nome` &&
        l1.criado_por_id === idoso.id,
      `status ${p1.status}`,
    );

    const p2 = await patch(idoso.token, `/remedios/${m1}`, { data_inicio: "2026-11-15", data_fim: "2026-10-01" });
    const l2 = await prisma.medicamento.findUnique({ where: { id: m1 } });
    ok("medicamento: data_fim antes de data_inicio: 400 e a linha não muda", p2.status === 400 && l2?.dosagem === "20 mg" && l2.data_inicio.toISOString().slice(0, 10) === "2026-10-01", `status ${p2.status}`);

    const p3 = await patch(outroIdoso.token, `/remedios/${m1}`, { dosagem: "99 mg" });
    ok("medicamento: de outro idoso = 404 e a linha não muda", p3.status === 404 && (await prisma.medicamento.findUnique({ where: { id: m1 } }))?.dosagem === "20 mg", `status ${p3.status}`);

    const p4 = await patch(cuidador.token, `/remedios/idoso/${idoso.id}/${m1}`, { dosagem: "99 mg" });
    const p4b = await patch(cuidador.token, `/remedios/${m1}`, { dosagem: "99 mg" });
    ok(
      "medicamento: cuidador com as 3 flags true: 403 por vínculo e 404 pela rota própria, linha não muda",
      p4.status === 403 && p4b.status === 404 && (await prisma.medicamento.findUnique({ where: { id: m1 } }))?.dosagem === "20 mg",
      `status ${p4.status}/${p4b.status}`,
    );

    const p5 = await patch(familiar.token, `/remedios/idoso/${idoso.id}/${m1}`, { dosagem: "99 mg" });
    ok("medicamento: familiar com modo_decisao 'idoso': 403 e a linha não muda", p5.status === 403 && (await prisma.medicamento.findUnique({ where: { id: m1 } }))?.dosagem === "20 mg", `status ${p5.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const p6 = await patch(familiar.token, `/remedios/idoso/${idoso.id}/${m1}`, { dosagem: "30 mg" });
    const l6 = await prisma.medicamento.findUnique({ where: { id: m1 } });
    ok("medicamento: familiar com modo_decisao 'familiar': 200 e editado_por_id do familiar", p6.status === 200 && l6?.dosagem === "30 mg" && l6.editado_por_id === familiar.id, `status ${p6.status}`);

    // ---------------------------------------------------------------- medicamento: DELETE (doses somem junto)
    const mAlheio = await semearMed(outroIdoso.id, 1);
    const dosesAntes = await dosesDe(m1);
    const d1 = await del(cuidador.token, `/remedios/idoso/${idoso.id}/${m1}`);
    ok("medicamento: cuidador com as 3 flags true não exclui: 403, medicamento e doses permanecem", d1.status === 403 && (await existeMed(m1)) && (await dosesDe(m1)) === dosesAntes, `status ${d1.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const d2 = await del(familiar.token, `/remedios/idoso/${idoso.id}/${m1}`);
    ok("medicamento: familiar com modo_decisao 'idoso' não exclui: 403, medicamento e doses permanecem", d2.status === 403 && (await existeMed(m1)) && (await dosesDe(m1)) === dosesAntes, `status ${d2.status}`);
    const d3 = await del(idoso.token, `/remedios/${mAlheio}`);
    ok("medicamento: de outro idoso = 404, medicamento e a dose dele permanecem", d3.status === 404 && (await existeMed(mAlheio)) && (await dosesDe(mAlheio)) === 1, `status ${d3.status}`);

    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const d4 = await del(familiar.token, `/remedios/idoso/${idoso.id}/${m1}`);
    ok(
      "medicamento: familiar com modo_decisao 'familiar' exclui: 204, medicamento e as 2 doses somem, dose de outro idoso permanece",
      d4.status === 204 && dosesAntes === 2 && !(await existeMed(m1)) && (await dosesDe(m1)) === 0 && (await dosesDe(mAlheio)) === 1,
      `status ${d4.status}, doses antes ${dosesAntes}`,
    );
    const d4b = await del(familiar.token, `/remedios/idoso/${idoso.id}/${m1}`);
    ok("medicamento: segundo DELETE: 404", d4b.status === 404, `status ${d4b.status}`);

    const m2 = await semearMed(idoso.id, 3);
    const d5 = await del(idoso.token, `/remedios/${m2}`);
    ok("medicamento: idoso exclui o próprio com 3 doses: 204 e tudo some", d5.status === 204 && !(await existeMed(m2)) && (await dosesDe(m2)) === 0, `status ${d5.status}`);
    const m3 = await semearMed(idoso.id, 0);
    const d6 = await del(idoso.token, `/remedios/${m3}`);
    ok("medicamento: sem doses também é excluído: 204", d6.status === 204 && !(await existeMed(m3)), `status ${d6.status}`);

    // Sobra só a dose do medicamento do outro idoso (as 2 + 3 doses excluídas junto saíram do banco).
    const meio = await contagens();
    ok("COUNT(*) de RegistroDoseMedicamento durante = antes + 1 (só a dose do outro idoso sobrou)", meio.dose === antes.dose + 1, `antes ${antes.dose}, durante ${meio.dose}`);
  } finally {
    // Ordem de FK: doses, medicamentos, registros de saúde, vínculos, contas.
    const meds = await prisma.medicamento.findMany({ where: { idoso_id: { in: usuarios } }, select: { id: true } });
    await prisma.registroDoseMedicamento.deleteMany({ where: { medicamento_id: { in: meds.map((m) => m.id) } } });
    await prisma.medicamento.deleteMany({ where: { idoso_id: { in: usuarios } } });
    await prisma.registroSaude.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { registrado_por_id: { in: usuarios } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    const depois = await contagens();
    ok("COUNT(*) de RegistroSaude depois da limpeza = antes", depois.saude === antes.saude, `antes ${antes.saude}, depois ${depois.saude}`);
    ok("COUNT(*) de Medicamento depois da limpeza = antes", depois.med === antes.med, `antes ${antes.med}, depois ${depois.med}`);
    ok("COUNT(*) de RegistroDoseMedicamento depois da limpeza = antes", depois.dose === antes.dose, `antes ${antes.dose}, depois ${depois.dose}`);
    ok("COUNT(*) de Usuario depois da limpeza = antes", depois.usuario === antes.usuario, `antes ${antes.usuario}, depois ${depois.usuario}`);
    ok("COUNT(*) de Vinculo depois da limpeza = antes", depois.vinculo === antes.vinculo, `antes ${antes.vinculo}, depois ${depois.vinculo}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: `verify-edex-${tag}` } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
    process.stdout.write = outOriginal;
    process.stderr.write = errOriginal;
    const vazou = capturado.join("").split(sentinela).length - 1;
    ok("0 ocorrências da sentinela em stdout e stderr", vazou === 0, `${vazou} ocorrência(s)`);
  }

  console.log("\nCenário".padEnd(120) + "Resultado");
  console.log("-".repeat(144));
  for (const r of results) console.log(r.name.padEnd(120) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
