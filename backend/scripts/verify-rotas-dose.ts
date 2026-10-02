// Verificação ponta a ponta do item 5.2 (RF-012): rota REAL (app de ./app via Supertest), Prisma REAL e
// SQL Server LOCAL. Os testes de Jest mockam o Prisma e verify-dose-medicamento.ts não passa pela rota;
// este script exercita o caminho inteiro junto.
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken (instância de lib/firebaseAdmin,
// a mesma que authHelpers.verifyFirebaseToken usa) passa a devolver { uid: <token> }, então o "token"
// enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e nenhuma chamada
// de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida. Todo dado
// criado (contas, vínculos, medicamentos, doses) é rastreado e apagado no finally; o COUNT(*) de
// RegistroDoseMedicamento é conferido antes, durante e depois. Não loga valores de dose.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;..." npx tsx scripts/verify-rotas-dose.ts
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
  const usuarios: number[] = [];
  const medicamentos: number[] = [];

  async function conta(perfil: "idoso" | "cuidador" | "familiar", modo: "idoso" | "familiar" | null = null) {
    const uid = `verify-dose-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: modo },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid };
  }

  async function vincular(idosoId: number, vinculadoId: number, tipo: "cuidador" | "familiar", flags: { dose?: boolean; saude?: boolean; evento?: boolean } = {}) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status: "aprovado",
        aprovador_id: idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: flags.dose ?? false,
        permite_registrar_saude: flags.saude ?? false,
        permite_criar_evento_cuidado: flags.evento ?? false,
      },
    });
  }

  async function medDireto(idosoId: number, ativo: boolean) {
    const m = await prisma.medicamento.create({
      data: { idoso_id: idosoId, criado_por_id: idosoId, editado_por_id: null, nome: "Medicamento de Teste", dosagem: "10 mg", frequencia: "2x ao dia", data_inicio: new Date("2026-10-01T00:00:00.000Z"), ativo },
      select: { id: true },
    });
    medicamentos.push(m.id);
    return m.id;
  }

  const dosesDe = (medId: number) => prisma.registroDoseMedicamento.findMany({ where: { medicamento_id: medId } });
  const contarDoses = () => prisma.registroDoseMedicamento.count();
  const post = (token: string, caminho: string, corpo: object) =>
    request(app).post(caminho).set("Authorization", `Bearer ${token}`).send(corpo);
  const DOSE = { status_administracao: "administrado" };

  const antes = await contarDoses();
  try {
    const idoso = await conta("idoso");
    const outroIdoso = await conta("idoso");
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    await vincular(idoso.id, cuidador.id, "cuidador", { saude: true, evento: true });
    await vincular(idoso.id, familiar.id, "familiar");

    // 1 e 2: idoso cadastra o medicamento e marca a dose.
    const cad = await post(idoso.token, "/remedios", { nome: "Medicamento de Teste", dosagem: "10 mg", frequencia: "2x ao dia", data_inicio: "2026-10-01" });
    ok("idoso cadastra medicamento (POST /remedios)", cad.status === 201, `status ${cad.status}`);
    const medId: number = cad.body.id;
    medicamentos.push(medId);

    const d1 = await post(idoso.token, `/remedios/${medId}/doses`, DOSE);
    const l1 = await dosesDe(medId);
    ok("idoso marca dose: 201 e registrado_por_id do idoso", d1.status === 201 && l1.length === 1 && l1[0].registrado_por_id === idoso.id, `status ${d1.status}, ${l1.length} linha(s)`);

    // 3: cuidador sem a flag de dose (as outras duas true).
    const rota = `/remedios/idoso/${idoso.id}/${medId}/doses`;
    const d2 = await post(cuidador.token, rota, DOSE);
    ok("cuidador permite_marcar_dose=false: 403 e nenhuma linha", d2.status === 403 && (await dosesDe(medId)).length === 1, `status ${d2.status}`);

    // 4: cuidador com a flag.
    await prisma.vinculo.updateMany({ where: { idoso_id: idoso.id, vinculado_id: cuidador.id }, data: { permite_marcar_dose: true } });
    const d3 = await post(cuidador.token, rota, DOSE);
    const l3 = await prisma.registroDoseMedicamento.findMany({ where: { medicamento_id: medId, registrado_por_id: cuidador.id } });
    ok("cuidador permite_marcar_dose=true: 201 e registrado_por_id do cuidador", d3.status === 201 && l3.length === 1, `status ${d3.status}, ${l3.length} linha(s)`);

    // 5 e 6: familiar conforme modo_decisao do idoso (NULL e 'idoso' valem 'idoso').
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "idoso" } });
    const d4 = await post(familiar.token, rota, DOSE);
    ok("familiar com modo_decisao 'idoso': 403 e nenhuma linha", d4.status === 403 && (await prisma.registroDoseMedicamento.count({ where: { registrado_por_id: familiar.id } })) === 0, `status ${d4.status}`);
    await prisma.usuario.update({ where: { id: idoso.id }, data: { modo_decisao: "familiar" } });
    const d5 = await post(familiar.token, rota, DOSE);
    const l5 = await prisma.registroDoseMedicamento.findMany({ where: { medicamento_id: medId, registrado_por_id: familiar.id } });
    ok("familiar com modo_decisao 'familiar': 201 e registrado_por_id do familiar", d5.status === 201 && l5.length === 1, `status ${d5.status}, ${l5.length} linha(s)`);

    // 7: medicamento de outro idoso e id inexistente respondem igual (status e corpo).
    const medAlheio = await medDireto(outroIdoso.id, true);
    const alheio = await post(idoso.token, `/remedios/${medAlheio}/doses`, DOSE);
    const inexistente = await post(idoso.token, `/remedios/2147483647/doses`, DOSE);
    ok("medicamento de outro idoso = 404 igual ao inexistente", alheio.status === 404 && inexistente.status === 404 && JSON.stringify(alheio.body) === JSON.stringify(inexistente.body), `status ${alheio.status} e ${inexistente.status}`);
    const alheioVinc = await post(familiar.token, `/remedios/idoso/${idoso.id}/${medAlheio}/doses`, DOSE);
    ok("medicamento de outro idoso via vínculo = 404 e nenhuma linha", alheioVinc.status === 404 && (await dosesDe(medAlheio)).length === 0, `status ${alheioVinc.status}`);

    // 8: medicamento inativo.
    const medInativo = await medDireto(idoso.id, false);
    const inativo = await post(idoso.token, `/remedios/${medInativo}/doses`, DOSE);
    ok("medicamento ativo=false = 409 e nenhuma linha", inativo.status === 409 && (await dosesDe(medInativo)).length === 0, `status ${inativo.status}`);

    // 9 e 10: status inválido e caixa diferente (o banco aceitaria; a rota barra).
    const n = await contarDoses();
    const invalido = await post(idoso.token, `/remedios/${medId}/doses`, { status_administracao: "tomado" });
    ok("status_administracao inválido = 400", invalido.status === 400, `status ${invalido.status}`);
    const caixa = await post(idoso.token, `/remedios/${medId}/doses`, { status_administracao: "ADMINISTRADO" });
    ok("status_administracao 'ADMINISTRADO' = 400 (rota barra, banco aceitaria)", caixa.status === 400 && (await contarDoses()) === n, `status ${caixa.status}`);

    // 11: três doses válidas criadas (idoso, cuidador, familiar).
    const durante = await contarDoses();
    ok("COUNT(*) durante = antes + 3 doses criadas", durante === antes + 3, `antes ${antes}, durante ${durante}`);
  } finally {
    // Ordem de FK: doses, vínculos, medicamentos, contas.
    await prisma.registroDoseMedicamento.deleteMany({ where: { OR: [{ medicamento_id: { in: medicamentos } }, { registrado_por_id: { in: usuarios } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.medicamento.deleteMany({ where: { OR: [{ id: { in: medicamentos } }, { idoso_id: { in: usuarios } }] } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    const depois = await contarDoses();
    ok("COUNT(*) depois da limpeza = antes", depois === antes, `antes ${antes}, depois ${depois}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: `verify-dose-${tag}` } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
  }

  console.log("\nCenário".padEnd(76) + "Resultado");
  console.log("-".repeat(100));
  for (const r of results) console.log(r.name.padEnd(76) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
